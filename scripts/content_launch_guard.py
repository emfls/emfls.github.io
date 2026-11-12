#!/usr/bin/env python3
"""Fail-closed validation for automated content launch diffs."""

import argparse
import csv
import io
import json
import os
import re
import subprocess
import unicodedata
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from zoneinfo import ZoneInfo

try:
    from scripts.content_launch_decisions import decisions_from_document, load_decisions
    from scripts.content_launch_policy import (
        DAILY_PUBLICATION_LIMIT,
        SITE_HOST,
        keyword_from_candidate_id,
        normalize_keyword,
        publication_day,
        published_manifest_dedupe_keys,
        requires_ymyl_review,
    )
    from scripts.content_url_planner import plan_url
    from scripts.external_content_opportunity import launch_readiness
except ModuleNotFoundError:
    from content_launch_decisions import decisions_from_document, load_decisions
    from content_launch_policy import (
        DAILY_PUBLICATION_LIMIT,
        SITE_HOST,
        keyword_from_candidate_id,
        normalize_keyword,
        publication_day,
        published_manifest_dedupe_keys,
        requires_ymyl_review,
    )
    from content_url_planner import plan_url
    from external_content_opportunity import launch_readiness


# Owner-approved RPM proposal, 2026-11-13. Exact cumulative base..head only.
# Base e61550880a45f4f6f570631ad69e8fb670c4d329; approved head 748f688596d4085a7ffa083c2f37c5f05119bd7c.
# No protected HOLD pages, deletions, renames or subsequent blobs are authorized.
APPROVED_RPM_OPTIMIZATION_20261113_TRANSITIONS = {
    'PROJECT_HISTORY.md': ('b8b627db21b053e22df2081c269d4b92faeff7ba', 'a85e877ef8e1cc4625185d7d50981210252f8904'),
    'TASKS.md': ('30c842545343be2724f1a463c6bdba0266cbd953', '634a5cf2b1d56b74bacf553a83996452c490d656'),
    'build_column_page.py': ('28abd4f0eeee03701af09dfb1fdcafdf41315d1f', 'bbd85812cda2c65b57c47c5b074848cf32f653e8'),
    'docs/adsense-slots-2026-11-13.md': (None, '7bdcc60dbc05db17b4e1af4ae0c8e0d97878a8ef'),
    'docs/superpowers/plans/2026-11-13-adsense-slots.md': (None, 'd875c908605e81acdb0d37c51d8a396c9834ac40'),
    'kor/column/ackman-microsoft-google-ai-investment-2026.html': ('771701f0a9a61b499f4417c9bc3cb829c74afeab', '33807f20aceca6a1c299a5cd4da6810f1baf442f'),
    'kor/column/ai-agent-orchestration-workflow-2026.html': ('dd212deca4f1f13cdaaf2ab9241184ec6ccfd5b0', 'c6cb49da6eaefbe3e788325c8a4c403947af1795'),
    'kor/column/ai-compute-futures-market-2026.html': ('d35c440b190dc02f96b7fc7588ca43d06a7f24ed', '3fbc9300389806f12bfb29ceef9206e0a086b109'),
    'kor/column/ai-era-community-survival-strategy-2026.html': ('5257a5eb36d6e17c679802ef8b7c09368a5c70f8', 'c3623ce9ff026b2aebe553d630b5182efd4cd990'),
    'kor/column/ai-era-human-subjectivity-2026.html': ('ab740478cebc469b2bbd5e14013b4a27d66d0daf', '24d276dd4b25185293c9e159285750398b693218'),
    'kor/column/ai-samsung-electro-analysis-2026.html': ('cfa91ee9089ff08fec0ac79e313db905e5eae295', '853137997e8298950bb8d0bd21611547e65a671e'),
    'kor/column/ai-shadow-openai-musk-2026.html': ('70ce0a0234b2c1b71ddb9c1c5a288a25a916e3f2', '4755c29520083d6b64dc7ed8473a3e7f06d605e5'),
    'kor/column/air-conditioner-care-2026.html': ('dcf11277b6e57953ba7e24ca9a0e5d6fb1dca2f2', '4ee4f9f8a98aa65d5b67f79f2a6ac1fcb32eff4f'),
    'kor/column/apple-ai-strategy-2026.html': ('2efef01e850f428ace4a0e31e81e56322e7c8012', 'd8bd5df8d5ad79f3465f3780a501d08213be271f'),
    'kor/column/asset-allocation-strategy-2026.html': ('be056fd9ff563fedd3a8ebbf26a22752df27afbe', 'cdf118dd8c59a02b761a5ff32d9f620dadc7575a'),
    'kor/column/baby-birthday-illness-dolchire-complete-guide-2026.html': ('e3c11b0768c722c25877d066e0672f47eb8d9b83', 'f72953612d8b2b651b148645a155ab94a8caeffb'),
    'kor/column/baby-fever-management-guide-2026.html': ('08d954ec7355272eff792bd77306262c793619ec', '540eca19ab5645180f72ec4e2e779dd46224afe6'),
    'kor/column/baby-green-stool-dont-worry-2026.html': ('7650d79161da2af4adb85139a088f1a305566edb', '752c947d7edb0680794f91462c1954cab13f51ae'),
    'kor/column/baby-joint-clicking-sound-2026.html': ('733773f63fd9d64fb238f3d9a7b53c60573fb134', '6c9726e91ad9bad64983ce9fd1c43462eebb8f50'),
    'kor/column/baby-plagiocephaly-early-treatment-2026.html': ('b28d63e15d025a0987ac2f179223c57c57c360e0', '24ea381e8ca590f82ee077fe4d67d32cff22d3c7'),
    'kor/column/baby-salt-intake-danger-pediatrician-2026.html': ('ef24bc2da66537a035a2c4c763372a00907246fa', '889f23eebd014aa3d1fb57a28cd14a605f402ce8'),
    'kor/column/baby-taeyeol-room-temp-bath-water-2026.html': ('f211a9a6cffcf5a8ec36d36c6678f00f0fce9e2a', '08a3184204ba1a51dec315bed984e1727609028a'),
    'kor/column/bcg-intradermal-percutaneous-vaccination-guide-2026.html': ('b3f95aed0ac23597c2a14e2d4000d31d68179eaa', '0f9514012092fcc510bc087c24d4f8d3c34faf9e'),
    'kor/column/bci-first-commercial-sale-china-2026.html': ('d5a0334e7bd4edfba0e1c00809eb7f4de90cd79a', '3414a6d47670c234456d9a131a1fcdac9b4973af'),
    'kor/column/billionaire-payroll-routine-2026.html': ('ed095ff3f0fb02248e0e5a1b47841e8863f72a82', '79f49bd03edf787596a2a9d153a494c0a9f36ade'),
    'kor/column/bolivia-anti-government-protest-roadblock-2026.html': ('34854501e617ac4b5a45a64bbe66c42acd477b1e', 'd66338b1f4c79dec6536afb588310b29d0bc87b8'),
    'kor/column/brain-plasticity-neuroplasticity-2026.html': ('aac969df52326936424c3c07220e289b07278103', 'b62dd929a6f956ccae04f3c7f8d5167a1fc7f35c'),
    'kor/column/breastfeeding-medication-safety-2026.html': ('ec357f996e5a380852464c378eba898b09af47d8', '29047c5c0a4c82c45c16022090e4955ea3f1deee'),
    'kor/column/bull-market-rich-investor-traits-2026.html': ('9015b78c611276ecc401a1df249014c80fa4367d', '7db8eeb1cb48b7db4a24c8a200d6e573e596854e'),
    'kor/column/bull-market-signals-invest-strategy-2026.html': ('3416d97fa6a40b4b0e024776c50a414ea68ef901', '39abe7af0e29fe9b836d4f5a425cc860f54d2a53'),
    'kor/column/car-ac-hidden-features-2026.html': ('c0747aa0d05f4603e8c9bb8963de817ef562623e', '6ae04da2b9424569e544ddf3baae3ab52209f8d9'),
    'kor/column/chatgpt-vs-claude-final-2026.html': ('530a6882d4e04bc7e6e0527a5661d42d6bb61677', '4ed1f4b2ff8efc5bcf85831e4dfb88fed74e0680'),
    'kor/column/chickenpox-varicella-vaccine-twice-2026.html': ('98981771d0e7f0104dfe197a22628ffc75b40501', '90360bcd722c745af2c62551e7e501de1c550cac'),
    'kor/column/child-cold-prevention-kindergarten-2026.html': ('0f607d9c7949ed3c3d0c621a5468522197b59179', '1336311ac35133592003a217aae4f0fcec895aa8'),
    'kor/column/child-constipation-diet-guide-2026.html': ('f947d9e2041cce74ea67536622bd6ca2bbfec56f', 'd4731266dbc15ad1ef2b43fc15796f29ae39887e'),
    'kor/column/child-covid-reinfection-risk-2026.html': ('2cac0dfbcb022c2025d26e608940dde6e9a61fa1', '712125c545de88a7c9cb446bde561db0df8905c6'),
    'kor/column/child-development-daily-experience-2026.html': ('697fc86daff458d5a11e443be90f53884a099fbb', '3c0bd4529663beeedf38ec2fb5ad9b4c8e83e13b'),
    'kor/column/child-discipline-mistakes-parenting-2026.html': ('a106ec3896fe092b85b90271987b8f9ebeb6dbca', 'c8cd748db32af53e0b1dfbace82a113fbd35d6dd'),
    'kor/column/child-febrile-seizure-guide-2026.html': ('e596af5a48368d8c6e39f24ea3f0ceab6f95baa7', '6cde9102494945e7beff648f29204b6428c2f1ce'),
    'kor/column/child-fever-antipyretics-guide-2026.html': ('c9ad7171e724378aeee5c6a92d14bc791941f464', '849ffc4809740abb0be315e8ce3327be5bb23826'),
    'kor/column/child-food-allergy-guide-2026.html': ('c900c9a759e5e1b95b158ec93cd0f4700d95d962', 'eeafca3b237e2e873e278e34feec9f395349f01a'),
    'kor/column/child-headache-parents-guide-2026.html': ('a9a173408986959107711b3139eadff8b9663794', '760f8d7c06663e4b3651893dd40cd04d664d061f'),
    'kor/column/child-hematuria-blood-urine-guide-2026.html': ('1fa0a3daae33106a4f34d43858a1555c7d675fe5', '76b7a140faeeb061691770df048c669edd19ddcc'),
    'kor/column/child-independence-trust-less-help-2026.html': ('7378884c9082b6f9c4b292f845ee04fea5dde33b', '6345a5178ddef171be5b312590f5fb3bb2826c60'),
    'kor/column/child-needs-self-soothing-parenting-2026.html': ('cfb7ca1c7edbccb0a4b1d03827359cd090af7d9c', '206449534a8785f73f8df338f6b8dfb15839c545'),
    'kor/column/child-night-terror-sleep-disorder-2026.html': ('00e8f14269c44111581a3147274a45e2148f0919', '864ad71c3298eb394583ed9ff9ff779f2ca51e02'),
    'kor/column/child-nosebleed-first-aid-2026.html': ('a0fe152a8cf4051a6d9fa25461848505f468b8a8', 'ce4809531080e27e4f6515905c2d77b6981f4974'),
    'kor/column/child-overprotection-parenting-guide-2026.html': ('74388e21a6bf9c516eac5d794d1347910bfc4d75', 'ffe6150df06f4028591101940957f4b155c8fe3e'),
    'kor/column/child-self-control-parenting-2026.html': ('d1ced7d16bb8b35b738970cab526d79440a581fa', '9aa91a92c946b0f87c7cae34758a26b52852294b'),
    'kor/column/child-social-awareness-parenting-guide-2026.html': ('5a75bd11f3ab8968adbd795e19d702541d042bcc', '7bd6c1b1510fe3c3990beea143b0bc93c264576e'),
    'kor/column/child-urticaria-hives-danger-signs-2026.html': ('7ca5668f534f9ff8fddbfa665595c4f3274bdbcb', '940111104d3acc668bf382ed5daceb692e1b36a5'),
    'kor/column/child-vomiting-reflux-baby-guide-2026.html': ('5bed2374685d004337e3978b91cf8ad0cb0840f2', 'ca7171ef53dc78e81d5920285cdb697e1a66b7e6'),
    'kor/column/children-covid-home-treatment-faq-2026.html': ('38a23ddaa5a8202668713dfc902cee5b68a4e30c', '3873b3058903659df3f34710f2257f408abf44a6'),
    'kor/column/children-covid-long-covid-complications-2026.html': ('198abf6a6aa9b1e7f0325d35a36ae2c92192ab3e', '2342ee3b542577deb08a9a4715ab1936dfc7c452'),
    'kor/column/children-fever-reducer-dosage-guide-2026.html': ('63241f0ac38f76c816d50a604a28de1517b78d78', 'c3be48876128fd195416fc9c4723662541348e5f'),
    'kor/column/children-tax-loan-agreement-2026.html': ('4e562b935a6d68e179f06c147c6ba690667e5db2', '6da1c92f8f85e02af8a6ec91197ba49ea042a608'),
    'kor/column/children-wound-first-aid-guide-2026.html': ('7069db78359bf22b68a8a4cf0c95b281f5a74ed0', 'e695817ccb478bff5efa04f071cc220d33026ce6'),
    'kor/column/china-speed-talent-war-2026.html': ('b75ec994d21f62b5973da8fb5f27f793aeab4b14', 'd65a42f854ffcbcae7dc47a8271af9477e72f01d'),
    'kor/column/claude-vs-chatgpt-practical-2026.html': ('50037fd4299ca99b6d4faea68b1d76bbd98a2035', '52c3c0c1a271f59caf896788616a04d058f227ad'),
    'kor/column/claude4-ai-agent-era-2026.html': ('00a1065f1a273c46a1046ea9beada1bc0fdeed6b', '18ac97faaf2b825d4fa62d52727d84cd0fc63f5f'),
    'kor/column/cold-antibiotic-faster-recovery-2026.html': ('ae8466a88b33c8604beb04563acec03b0c6f941e', '15be3060b1384d0a5be3f69244adcdb6dc586e4c'),
    'kor/column/cold-antibiotic-use-children-2026.html': ('08636d4c7669b809f00c09b4efeadd6e148fd11e', 'a432fc0239f623004b249b76241587408af44505'),
    'kor/column/cold-no-treatment-children-danger-2026.html': ('f7da64690448757c4056a8db27bbdd3865ce4b3b', '28a2c0696e701c3cc32483d0ec4df96895156ae6'),
    'kor/column/cold-prevention-tips-kindergarten-kids-2026.html': ('d6c6b4b065634cf85aed631b3bb0ca31ca576bef', '4608b0c5cb3f19bebfbb4fc16f696ffb5bf3a0b5'),
    'kor/column/cold-sweat-children-parenting-guide-2026.html': ('b69d61a57381fac5cf98382387b1d5bf1abf2142', '32ceb1bf36f4c2b31732a3db935d4740f103ae29'),
    'kor/column/commodity-stagflation-iran-2026.html': ('ca269b376f4825401f29f0fb294ec73460a670bb', '37b2d8dfab418d8e94f791f6785de55ac9a5bc47'),
    'kor/column/convenience-store-gourmet-guide-2026.html': ('8194711697806b9b3e31fde5311b4bc35d6b8d71', '96c23ccf324041674d027fa23a31db45cfedba43'),
    'kor/column/corona-fever-children-antipyretic-2026.html': ('a5c0e294fad993f5b97b7b320bb1f35691999944', '5c31878deb9ee0201625685e285c59ca3654ae45'),
    'kor/column/corona-kids-antibiotics-2026.html': ('53e633fe3233331bf2e9033e89df415138fd6561', 'eb409892f5d3f29665523b1f7938d1b4c4b3c7fd'),
    'kor/column/corona-money-maturity-macro-2026.html': ('ec1579428c9152383a95e20d4d88dbcbfe764930', 'f50b0c55d43d0b21a4e0697e6145447f8dc14a79'),
    'kor/column/corona-test-long-covid-children-2026.html': ('78bb920df780056f12e3e12116f4f0ac30cde55b', '9351360b84ca0a1625c8e3f3f14712e9fe85a456'),
    'kor/column/covid-child-cough-care-guide-2026.html': ('72fe8eec1d0df9eb88360c3c245c8c1dd18cac42', 'ac07c88fbf5ad860da1fb507de70b7ca5b461d31'),
    'kor/column/covid-child-fever-management-2026.html': ('57446fbd5211faa688dcc254a650b0456652e4a3', 'a8845cfd55c2ec31b47c21102e6fbd7807231025'),
    'kor/column/covid-child-homecare-preparation-2026.html': ('49d62ddd4026c01226966e72b3b15e3a2edc5c95', '8a6b1551867de88c364b1d4dc9421a1710283741'),
    'kor/column/covid-children-protection-withcorona-2-2026.html': ('3e31870c79acd9d6be509e39d0dd38f850929d4e', 'd029e58c763b04db5e399befc21faa078d34694c'),
    'kor/column/covid-children-protection-withcorona-2026.html': ('ce86da17d047658e4ad3d2b840c56d323f8e242a', 'daa80b7b60f69d3eaf16389cd656c0bc605ac83d'),
    'kor/column/covid-isolation-garbage-disposal-2026.html': ('73b6b9129d198a425805a8e78663e103d9480381', '9cd086ae39ec442d26b7682055fa97a7a59bcf68'),
    'kor/column/covid-omicron-reinfection-stealth-2026.html': ('1acdb2883b556289a8ce102eb8ed55bbbecacd03', 'e1910d5af5ee386c2af5849f3445e8eeb03e45e5'),
    'kor/column/covid-parent-positive-child-negative-guide-2026.html': ('5f3df39684c0c9dd7bcc12b722d9c479d218229d', '57865a94b8ca25afe5c6934f9883a19ea081015c'),
    'kor/column/covid-pet-care-quarantine-guide-2026.html': ('dba167606d79eb7e1e74e0d8a484be38a45baa26', 'ff5afad6108acb44756e775a5441e6eeb01df1db'),
    'kor/column/covid-post-quarantine-cough-children-2026.html': ('8d4fbaf171ba1386a8176d10ab95f50c29a9b5af', 'f9f34178014aa34a834a60630a8a6c52d6815fc3'),
    'kor/column/covid-quarantine-cleaning-disinfection-2026.html': ('7c3c4d20316909760e3d6baa3111f27ce4dee358', '7a00fa960203c37aaf347cc588f1491af97d2d5c'),
    'kor/column/covid-reinfection-criteria-2026.html': ('238bf2e0afb271c87afe09744d4d915aa1234689', '0d7bb8135c5154d3eff202acaa63ac9a0cc7b2bd'),
    'kor/column/covid-vaccination-timing-children-2026.html': ('6328b316ee01b9002ce99af170624110c3559f4b', '42b73f35d5cc1ca103f382ebf11105bae8f55071'),
    'kor/column/covid-vaccine-latest-update-guide-2026.html': ('3017e0f155d127693a13dc77a84fe54047d711c6', '8a6157a361cd562ebff3443e00d29c57b0c3f7b9'),
    'kor/column/diabetes-insulin-resistance-2026.html': ('664eee42c843cc0f676ac9839057a49ac98d49d6', '1e8906c47353db2e4a0ca148ffd1e45f9cd2f2f6'),
    'kor/column/digital-product-ai-gumroad-2026.html': ('44a517bd5c4e21c3540af0657ccf71c8c2c2b4de', '0ea84dcffd6c63c355b876d9da06d2fd0bf2295a'),
    'kor/column/discipline-easy-from-birth-2026.html': ('966e156de4646c5e5bbbb90f2dde750790f105aa', '5ed6d7be9103716db3163e9498313df39194e874'),
    'kor/column/dollar-hegemony-2026.html': ('c0b28ee12857f661def85049268f2a878ffd8354', '59abd0b088569a438c0c7d242c537e5ae61aaa2d'),
    'kor/column/dopamine-rewiring-2026.html': ('46c378910f318176f3225f193d99dadcb5d927e8', '68e562f8af7b4909b61344a0dfaa5c79e9de3d4b'),
    'kor/column/dual-income-attachment-parenting-2026.html': ('5572965bfcc46cb7398241a484fb2fff053da282', '101a84c1b1e232dd8ecf03e2149a9687ca7977f5'),
    'kor/column/elden-ring-liurnia-east-guide-part2-2026.html': ('2d9bfe35b2978c49fad6ea094300461b57675d7d', '75b205e91e811a2ec1e8f2aaed33098f86b32a44'),
    'kor/column/elden-ring-liurnia-north-part2-guide-2026.html': ('9b3d6398ec5cc23dbe13119676adda22b9fd23ba', '648e347996b95103d8a9734b09ab9fbfb21873bd'),
    'kor/column/english-speaking-relations-2026.html': ('e3b9062662c04b01b1d31752c2557cf47908cc86', '1e7b25ae2bc1885f386ace1414ee051e9cbad7f2'),
    'kor/column/everyday-parenting-matters-most-2026.html': ('e6f106bb4ce3c6083a594afe1897fb1d12cf2ed6', '4b0ac8303e625098f55805446aaaede09d463167'),
    'kor/column/facial-asymmetry-guide-2026.html': ('46da256ff1a8b1882880d4d7f494e3956dd47e45', '2b864d8d74fa54f0ff78e9fc99a459f0820f89f9'),
    'kor/column/family-account-transfer-tax-2026.html': ('75fe89e6696bd3d6cb6a35b7ee66cef26f98b226', '4b8bbb7151a4e716973f0fb5257cd9d87404854d'),
    'kor/column/family-loan-agreement-guide-2026.html': ('a551ddbda28e82cb645215778b0f6763297eca5c', 'c4ec9a200c5aa801dc3fb08c25b51289e81f69fd'),
    'kor/column/febrile-seizure-covid-high-fever-2026.html': ('4185dc55adf1e2a332d7db6af54413e503a30e76', 'bd68aa7d40c3d9fdc7abe997324f89cd4f6cc3a0'),
    'kor/column/fever-reducer-shortage-ibuprofen-2026.html': ('aae8a6bfdd427cbbd288350740c11e4700ca520c', 'fe08e500f8063d79804e4947239c0c42d10c72fe'),
    'kor/column/fine-dust-child-health-2026.html': ('35b711acc3b74eac8fcff3e208c0f9f51e4d84ff', '21d06f24eda6a595a0076f37c481c8ccc26d630a'),
    'kor/column/fine-dust-pregnancy-birth-defect-risk-2026.html': ('6f37ac12a231076c59ad7ff4c25f516e5abde8d9', '4ee0c7b0d2d51e7bc75a180c48f2fe04df4906cc'),
    'kor/column/fire-movement-early-retirement-2026.html': ('866630f2cade2c9831aff38c63482e6f00093d49', '16c6f902b1e59ed084b8064874cd43253275c05b'),
    'kor/column/flu-free-vaccine-suspension-explained-2026.html': ('80e803ceffbd268336251b9558a7f042de2e8214', '9ac4427c126e7789a80366d00b968cf081dff2b6'),
    'kor/column/flu-vaccination-qa-complete-guide-2026.html': ('727e787e9175eb8b50ed4a4b71fed7da84321430', 'd744b35df01cf1614a1d0af2f756acad3f0107cb'),
    'kor/column/fluoride-varnish-kids-dental-2026.html': ('00177d63ac459dbf17ed165fe3daed3033bb50a4', '23ed998346bb4c9d2935006cceae89a05bc30848'),
    'kor/column/food-poisoning-childcare-tips-2026.html': ('1289498a30403756ef4bb759673bf0ea49ffab35', '20f94551655e2897198c0da2c05d2d702fec933e'),
    'kor/column/formula-green-stool-baby-2026.html': ('fd908d08255000263cef93f566728563ff531e41', 'aebce934830c093bb0096fc70ff75054ee020b41'),
    'kor/column/frequent-colds-children-guide-2026.html': ('d6d36af00c7e6f15eed38a9c19dc0bb5a95189b2', '4ddd2346b658cccd79375de27a728f14bbde40f8'),
    'kor/column/gemini-features-10-2026.html': ('bc729b34c52a35ba516550125cb1ba6473d8bd5a', 'e635d082ad9d53b3f250feb837a2ac0dcecd3eab'),
    'kor/column/global-computing-war-xai-2026.html': ('ca67ac5c800d39262a288baec65e77d38b3b4ba5', '96c01cbf5bcac1dfaf2eb6a2bb6f5dfce4469dd0'),
    'kor/column/gold-investment-strategy-2026.html': ('7cbdcf51cb6608535e2da50739cb17a68ef5f813', '5b88bcaec5799b143de6df471360b9c0487c029d'),
    'kor/column/google-deepmind-ai-science-future-2026.html': ('6e3e51fec8c5496f3e51505aaabf741b8b087a99', '37fbc40f2ba4f9e129a683b195066f2daa3864d7'),
    'kor/column/google-io-2026-summary-2026.html': ('c795f0ecc41d3c78b1708df5909978b7428d972a', 'c31b03d8d4052b7cf6612b1260c24cc191b79a18'),
    'kor/column/google-zanzibar-permission-management-2026.html': ('9649dd975bab61cf44f9b699f77ab1b370c4d8e0', '34b8fe37fa3c0bc26da3c58c02459d48228ec4d7'),
    'kor/column/gpt55-goblin-rlhf-2026.html': ('49facc67e9ed0b928edf77f9edee480f05a3cdf3', '443548ed1b2ccc0c679e88aba5cbfe032fbe9a65'),
    'kor/column/hand-foot-mouth-disease-guide-2026.html': ('89066cf44fb682904bfd0356101120c97af7e3d0', '152a2f06f5d98a968b58e4f4d2115bda5f72815c'),
    'kor/column/health-insurance-tax-strategy-2026.html': ('15ab6ffee0f84e3ffe941e1c13bf0a689b4b99b6', '72850426698ce41d1203243a454d452b30fe0e7f'),
    'kor/column/healthy-sleep-habit-2026.html': ('30ee80fb0c03db5605c131423063d8562b2daa18', 'cbf1549fe076bb2947f8c36d3df5ac5d4e348ef4'),
    'kor/column/heatstroke-prevention-summer-guide-2026.html': ('980f1aa89077ee5204a1e7aa5895491c026d7aaa', '48e6aba9f3895ad43efc85224fbd32e461cc653e'),
    'kor/column/hemolytic-uremic-syndrome-hus-2026.html': ('2f39d27bc1552aaf1363422f0d5ee67645732aa4', '4cbab64fbebf6f47d7e6626b0d2da362bee993ce'),
    'kor/column/hepatitis-a-outbreak-prevention-2026.html': ('aa79dce25fa4500dab628673daad6f92fef04a67', 'da01076ae11f878d9ec458df5ae4fd7d6889e0ee'),
    'kor/column/high-dividend-strategy-2026.html': ('537910c4ef0a8a110e0da62666f35d999fab6d28', 'f271913ed87cbd0012e443d1290974087a3a07a7'),
    'kor/column/howard-marks-oaktree-ai-bubble-contrarian-2026.html': ('25b8dbd59abd27e4ad2362e34efe20012031397f', '5ea7e7a41971527c7fdf69114986c0134ba22fee'),
    'kor/column/humidifier-safe-use-guide-2026.html': ('d54939463bf1db338ce41c7723185d11139c9bf7', 'd86c989686e8f78ce76bf8dda8d03ddb8fd23725'),
    'kor/column/impetigo-child-skin-infection-2026.html': ('e1af4e63add143871981454e49f5a52055f74b5e', '0fe1811fd721604d2ecf588e3a4cdf2ace1b5213'),
    'kor/column/impulse-spending-dopamine-psychology-2026.html': ('0822a7830dfb21f4ca32576655fb5c302c1cab34', 'acaac6e1d69f6b4f3d2365bbdb70349ca1556531'),
    'kor/column/infant-sleep-heat-rash-2026.html': ('1004025bd4d47d00fb75c4b6eb67ee16e962e357', '2b66bbd29b441572e634ebd516d92414cb1e9a4f'),
    'kor/column/infant-torticollis-early-detection-2026.html': ('64f88a245f05b3871c12c3c2694dd37146c0e4f8', '976e4cba3637b2f81f1b5e84ffbc09c6dc5382e8'),
    'kor/column/inguinal-hernia-baby-danger-surgery-2026.html': ('113db4b1c1e34e286cb9b1a0f21058742fbf1f71', '088814483dba1f9641adc1c0033a2387cd52ac14'),
    'kor/column/investment-compound-interest-time-2026.html': ('843cb7107e0de2e515a7455ba775cd9e73688593', '515ec22d6bf1765b9c49b9b47bfc0d437b87af48'),
    'kor/column/iren-anthropic-time-to-power-2026.html': ('67f596093a761ae2865dd0eeb197b3e801bac8aa', 'e96f68e1500849648f4e0bb6ff5769dc0b16afa8'),
    'kor/column/japan-ycc-us-treasury-macro-2026.html': ('d0078e25a410439f91bcabf9a8bd5e56b76c22b9', 'fd2c4351388e664862165a4cc81e362c243d6e80'),
    'kor/column/japanese-encephalitis-vaccination-warning-2026.html': ('c39efe32ad3105d7ffa7b7422e5a21ecf9532447', '7afc91ebd4e0243f13401d19d84130315e3b05f2'),
    'kor/column/karpathy-claude-md-65-lines-ai-coding-2026.html': ('5f0fa49f10d32706816d1468518ecf08eb7eaa0d', '78a44b3c0ab3fb2d9aba84b80c2889219e924ea6'),
    'kor/column/kevin-warsh-fed-2026.html': ('0affc20f2e647e986ce2a59c40452452cfe82074', '164aac3861e5ede9eed431202ed5d268175cb01b'),
    'kor/column/kospi-8000-fomo-investment-2026.html': ('895d1bea0a56bb3dd93bfc4743771fa478002aef', 'bd2f3dc726d0b7bb19068f939398b5ff367a5887'),
    'kor/column/kospi-8400-won-weak-dollar-2026.html': ('e4d8477203487c50903bbfcdb15d22752fff2421', '056ca743fea9c147bd34df20a279950efe90f5c6'),
    'kor/column/late-talking-children-speech-therapy-2026.html': ('639b351540c7b00a95420a8419f681148520ec39', 'b90713e638aa702ddfac78c94c78d154ba2e7f18'),
    'kor/column/lessons-from-successful-friends-2026.html': ('c2f24ab10f0f86a97e159112e087471763928771', 'd1ab5d74a7843a35bf13c6e6d9a67708ed47d21f'),
    'kor/column/lh-deundeon-jeonse-no-restriction-2026.html': ('a19314a6402434e563f01368dd6f061159870579', '9f6d9808df2e13050dadae5610c497ee3e66c883'),
    'kor/column/mabinogi-mobile-newbie-growth-guide-2026.html': ('83dd9405bc0e0956e2fab15c2c56519d1468553e', '1478b19a8e8d1fed3ad2dcd903bea35669bdbd36'),
    'kor/column/mabinogi-season2-preview-2026.html': ('57456915edbe9e271e6a52bd3d45a111642bc85e', '18b09a19a507786e4822f4c7d778dc9e016a4027'),
    'kor/column/magnificent-few-ipo-2026.html': ('9303fd2bfbb1d21109674b8bd41091397107e9c2', '66076a95ef287a06a8419b26fb1c575709fa331a'),
    'kor/column/meningococcal-meningitis-no-alert-2026.html': ('93cc127f96066c9b02c174940d3150739521fa29', 'a62c5dfc52a2629bb33fd04cb9052a7ca7a1818b'),
    'kor/column/meta-ai-subscription-economy-2026.html': ('05c9e5d1acfcc60ff1ec6518f538869e31313e7c', '0931dc6564a6e755ae856feac0e8fa29344ba779'),
    'kor/column/meta-manus-geopolitics-2026.html': ('302ed90ed74c07da37b0766c911807618b52d6db', '399b02fc96cbed05071cb18d6a15753265dfc96f'),
    'kor/column/mid-term-bond-active-etf-2026.html': ('ad90aa746ee3249d225b46913d113314d579895c', 'eea1a3397dcdc7c1ed13dde5661fca0fc12b0372'),
    'kor/column/moodys-us-downgrade-korea-investment-2026.html': ('eec899bd139d7f02cc4acab2939b2af4add36ed9', '71e5ef2eb63ea92316be92e68910ad195423edd3'),
    'kor/column/motion-sickness-prevention-treatment-2026.html': ('95eca4ad2296ca2b88ebe5ecb050a76dc6da1f82', 'f9d619cb8b6713bec339d3d3cc5e735796ba4897'),
    'kor/column/msg-safety-children-parenting-2026.html': ('bc621d5ce2cac352498f017e4d872f0b23350e21', 'ec5b26379f443cd7f1de6a71f307953f56917c9a'),
    'kor/column/nasdaq100-fast-entry-2026.html': ('c6f45d98ca11fe79b864b6522ba972e6236d45f4', '856d8166547eb0e15f1db33bc43830dd1b839825'),
    'kor/column/national-growth-fund-2026.html': ('e5ff7f6945cec733f87f52a615bab8e7c2ff1955', 'd6f57cdb5b38fbf65f89621a9f46b8edb47bc8d0'),
    'kor/column/naver-ai-crisis-2026.html': ('f6ae3679aa3b6f345c3cc5761333ae9f5d5eaab5', 'eaa63da12b7d7cfe69d9a708ef005edfcbe791d8'),
    'kor/column/naver-blog-survival-channel-2026.html': ('5901520b2558f598f80fa26cbc83cd73bed8481e', '7c622b181713433c8280718154097c48078ce60f'),
    'kor/column/naver-stock-ai-growth-2026.html': ('3d4603d37b3aea0009f15165b9da5bb1d2ec04c3', 'b5b5b9f6f5eedea1f74a5ebb609d7c3f36651ef0'),
    'kor/column/naver-stock-paradox-2026.html': ('f75ed434461f65e97bb6c958dd88e18aab18be04', '7f4275ea2783a6b09f68859c632c0b39a2e2601d'),
    'kor/column/neuralink-bci-drone-2026.html': ('73fae6b7afc8d781b2b55bda9bc743866bdb387d', 'be291ef45a2e371c39afa03a88201676e4831eb4'),
    'kor/column/newborn-covid-prevention-rooming-in-2026.html': ('b919b0501530a83eea7dad216bd5319dae21f3ae', 'e2e0ee2630754be460ff918ca1f4023d716ea529'),
    'kor/column/newborn-eye-discharge-care-2026.html': ('72fe6e67c2ee24793ff41cd7a90f7e2784ca178f', '80a85acb1e3d291c89d086b46db1ad06e88b74d1'),
    'kor/column/newborn-jaundice-breastfeeding-2026.html': ('4506966d25c44d557b772a77ae294ac3ef16d77c', 'a6049f383efc876238cea56cdd15fce6b866c896'),
    'kor/column/no-overparenting-child-self-reliance-2026.html': ('0fb4d2648af477dcd7677524965c9b92ab9f7ea5', '9be93cecc538c31ab91b9c300acaedc539d9d05c'),
    'kor/column/nocturnal-enuresis-bedwetting-child-2026.html': ('98d0390a7815e1676e71ee0cc3f41dd3a6bfa889', '7d6b6e605b5e9f5ae2212fc89316cb07bbedc4be'),
    'kor/column/norovirus-gastroenteritis-prevention-2026.html': ('4d3d7de0959ff153b96127caa2d7636c60b7d937', '2a728594bbfac4074e66cfc207dff43241fd55d1'),
    'kor/column/nps-investment-strategy-2026.html': ('afc31a49424fc69f6bd14e0b3afebc86135bd6ed', '7ef10db944c7cbf0ef73ca9ecd42f5579bd824ef'),
    'kor/column/nvidia-blackwell-gpu-revolution-2026.html': ('a900b5402e99527fd73058862884e86cb4e5466e', '2a96cdf43c6377f8929e635309c332c0364e8560'),
    'kor/column/nvidia-earnings-2026.html': ('21b2d144d91ff66cbc1515cf73cbd80838624d63', '39536b1eebae9971e946b5c3109b45ef0cae5a5b'),
    'kor/column/nvidia-geopolitics-memory-2026.html': ('d72eb38afb53a134f11bde889e8ce58982c93da6', '55821647f977f92b54e1cebbec485b8078ae3333'),
    'kor/column/nvidia-stock-outlook-2026.html': ('ebbbfe6e94a15f03bfa203a6cb332d2fc30324b5', 'd43a69e0bf5985b24e8bbeb28efe8f59519e8bba'),
    'kor/column/openai-o3-reasoning-agent-2026.html': ('f181ff5f12a2d47b34ab296655130b339f9a3168', 'ce5074120b21fdc59696cd66998d3a902674b687'),
    'kor/column/palantir-enterprise-ai-ontology-2026.html': ('a8107777a500335bacf0314ec54f39a7d2628f80', 'e06c54cd06ae05b9398b85225c69eecbf97e7b0c'),
    'kor/column/parenting-all-in-balance-2026.html': ('876cce2b03a640fc814d3547e455773a029b40dd', '084a9863704af799e1d9e794cb1cbbd14b13df9b'),
    'kor/column/parenting-discipline-conviction-2026.html': ('c014182f51f9faedd440c6cc38e2090d90fc9d3b', 'b536a77ffc1b09a77d5563a0a03e649e748fd9f0'),
    'kor/column/parenting-discipline-early-2026.html': ('b2450468df990afa68c07ab5852b084b48ba6c6c', 'f87ff5ba99dc77eec928236327172aea3e18f8dd'),
    'kor/column/peanut-allergy-prevention-baby-food-2026.html': ('998fc7d68397db6ef43744f2a3a359a5c016a1af', 'd0aabb073d0299e7ad85556afe9f831a8c40b9c8'),
    'kor/column/peripheral-artery-disease-2026.html': ('1f380f5d4da3ba73885691b5d43bb41bed9bd4c6', '00fa16b2dfd211d8c6ac2c1ba168bdd7c6c7e51e'),
    'kor/column/portfolio-analysis-2026.html': ('04bfc2e7f7df6fc205c6818bd67ca0e46b3e65c2', 'f25ee1afbf9bb2e58a4347e60537a36a33e95d2e'),
    'kor/column/power-infrastructure-koppers-2026.html': ('5a4814443ed7c1a2eee6b77f10f5ccb719cfbbf7', '74b19aa48f1a694f384220d91cbd37430ef50c17'),
    'kor/column/pregnant-covid-vaccine-guide-2026.html': ('ed4e0296ffd4bd08fbe3a0da0eac55b80f823063', '0e1f674394f61a0e25ca9377e733fbde704a271b'),
    'kor/column/procrastination-brain-anxiety-2026.html': ('46bd1dece9ba70edc28c45b23109fe0542d0e0d5', '4370aad9aee154b411776628051d4a2c4fc8ced3'),
    'kor/column/quantum-computer-commercialization-2026.html': ('476b650f8dcad904453a0f3e567e41f28a4dcdfe', 'a85407486dc63185c74e3e942b945a84942feed0'),
    'kor/column/quantumscape-ev-battery-ai-datacenter-2026.html': ('50f0cd42ba06a739a6d356f48806eee9385709ae', 'c04f8486beb0405790b9c3cbf262ed849e7a81af'),
    'kor/column/raise-kids-5percent-less-2026.html': ('fec0f5b1988336cf9c4631211276f3399b7cbb5f', '72d2163111a4f5bdb4ff2a604d19c0c0b81445a5'),
    'kor/column/raw-fish-sashimi-kids-age-guide-2026.html': ('17bdb8482bae9abcb8826cbdb9e19aa774742289', '4a4bcf63e0de6874bf62774ccd99fe0610a2a75c'),
    'kor/column/real-estate-study-guide-2026.html': ('c59b2fbb4bc1c79e13c74c67540daa39fd401447', 'ff15151eb33f488a78c97de23e976666e9c14f71'),
    'kor/column/regeneration-cream-panthenol-2026.html': ('c668377901cb7d586ba0adc6b1255d6cea828efa', 'ffdf17b758b11d2108daa70f61642bb0f0cda570'),
    'kor/column/rich-people-live-frugally-capitalism-2026.html': ('ecefd308790289c7883fd16020a1e76327fc2205', '0dda1f3ee1f055e3acc2b41161f78363dd2c43c9'),
    'kor/column/robot-construction-2026.html': ('1cd515b1164476624566c0b162ca0cf292331f3a', '5d388a0e8872927015d17edfac19bd39f9b5d60b'),
    'kor/column/robot-monk-gabi-2026.html': ('a955ddf2266c7eae935231735108ec2e16cd2d2b', 'af8f100cd6364b940e12792e54a18e206ae3f88f'),
    'kor/column/rocketlab-spacex-ipo-2026.html': ('b638b79dee2575776b54018b6edecd144bc5b76f', '8ddcb2e2a74c32d3f937f223d153ed070aa00f0c'),
    'kor/column/samsung-labor-crisis-2026.html': ('523c317f41ecae6079613008b013ea69b966e00d', 'bda98c40fac6c4071ffdc79674eb814a3664618b'),
    'kor/column/sarcopenia-muscle-loss-2026.html': ('49bec674df65fabaad221695a89b8696fd04423f', '6ebec344618082ae1a84499b8994dd127c22f32d'),
    'kor/column/self-learning-brain-child-development-2026.html': ('af7b96d7360b07efea8ab74812c9c9bc9555ffd8', '80682b41e857cbdf32427050500c018a0f88c4ef'),
    'kor/column/skull-cave-2026.html': ('4a3a38e909658d8256f45360a32ba5b13f5aea72', 'e80dc6e28385686f45f2a7cc3670d97eae9d2c18'),
    'kor/column/sleep-social-jetlag-2026.html': ('2ba86441692e6cf5f6c9c92cb8f2034b78a9cb49', '26c69fe165b8bda339e165ee864b3540e17340f8'),
    'kor/column/smr-nuclear-stock-wall-street-2026.html': ('91c6df3b355320f81464455f90288f16454d7c67', '448c10c245d07a1bddc387c961c8413214e81e95'),
    'kor/column/sns-loneliness-paradox-2026.html': ('93b2d99e917d58338ea8bde8925d7dbd8d839f67', '2d07252a78ccf247fa540238d26e33ac309950f2'),
    'kor/column/sp500-nasdaq-forward-eps-monthly-invest-2026.html': ('54ac133d06763177b34b5f6c2324abce8c52d9ca', '8f3ddc8f6f56e16d92639244aeb8a8963aef9005'),
    'kor/column/spacex-ai-empire-2026.html': ('e65ae904e8dabe5743a11cf673003df16ee49fcf', 'bc53a529a783819845a192c41fe5ec22d91c2221'),
    'kor/column/spacex-ipo-2026.html': ('0dec7290f2ef0916aff214e479ce8f2a1219f8c0', 'c079046479fce0ce4519f77741913fbcfae72751'),
    'kor/column/spacex-ipo-strategy-2026.html': ('e8ca2f0f23be2804414f6335d25a3fb13aaebe4d', 'a407df46d48da37174f8c056366a24bd621a1da5'),
    'kor/column/stock-ai-assistant-gemini-2026.html': ('41b0bbb42f076f15be0193e87d5f39cc1238868e', 'ea9eb23543f43c4b17073804c18626eefbddaa05'),
    'kor/column/stock-master-beginners-2026.html': ('a785039a1f432aa69264fdee3a00a45b8a63aeda', 'f26a460462a5cc46349dab56a609ef4be77ab490'),
    'kor/column/stock-top10-strategy-2026.html': ('6f3c7ac6b71b552334aac3b217b40cc5baccdeaa', '28b43e00dab1bf78d8bff2b97928b7689bcd3507'),
    'kor/column/strabismus-children-early-treatment-2026.html': ('cb376c4203191399f8e01ca68e9dd8d025ceddce', 'a29696c26a25182bfc18ffa46a5460a654e01e0c'),
    'kor/column/sugar-added-daily-limit-children-adults-2026.html': ('68ee6d24f2cc8fbd10fd8d05cf944e794d41cf60', 'ff3f6318c0e4d102fcad801fce5848075b70977a'),
    'kor/column/summer-cooling-disease-prevention-2026.html': ('31d613e32e049d4d1758f6cd420905f2ae34d8d4', 'f41fd0c205f129fd05394469d18ce5bdb67a88e6'),
    'kor/column/summer-travel-camping-2026.html': ('f8ee4611830f6d8447dfd66ad83e7eed17b0c40b', '65635c898ec1a3df8ceb524bfe360471f7c229e7'),
    'kor/column/sunscreen-spf-guide-2026.html': ('757125e2c9c766a7f0d2b5d34c97cfed9ce69997', '22f32f42abf518c39b6c877af2372ce80f93d836'),
    'kor/column/teeth-baby-food-no-relation-2026.html': ('c10728f39742619579de2c11669a7a07d8e66a6f', '8a807d1c81bfd1278abc82d9fd59bd5c7c6bc03c'),
    'kor/column/tesla-fsd-autonomous-driving-status-2026.html': ('88686b770093fe44cdca537a55cca591219bdce7', '3cfac5ae6b000af8d42280f24bae008e027720b4'),
    'kor/column/tesla-fsd-china-2026.html': ('fce933b58be5dd202a4dd9e7337eabf85c5768df', 'd8095a3462afc770450a89dd986b287e3b5bdc18'),
    'kor/column/tesla-level4-texas-fsd-certification-2-2026.html': ('7b5e348adec608bcd935abaa8cd121566a08ff3b', '56ddcb818de465058e32927a23f05160b7a25214'),
    'kor/column/tesla-level4-texas-fsd-certification-2026.html': ('c477e36575281aa58e03bd7aa9b8e2f3feb9d388', 'f324f1894ae333f7b0e2ba1f0fc66cd3deb5d49e'),
    'kor/column/tesla-xai-starship-waymo-2026.html': ('cc72ee35ee30b662c1ca22fb950f317d4b15cabd', 'c22360e716844f53e4562256c389e7db0afe3d3c'),
    'kor/column/token-maxxing-ai-economy-2026.html': ('3998dcd6d6c5c12451893bf78fdcae41de9b8cf1', 'a97e0a753e755d12ee3608e06db813dcf06db447'),
    'kor/column/top1-percent-korea-61billion-happy-2026.html': ('80cba7a4a9e6eb0179f7f425f6d1808255cad462', '7ef284a852811731b01fd3952c089412890c1dd6'),
    'kor/column/tsmc-semiconductor-hegemony-2026.html': ('521ebf207f2e5962945ad6d24694bfe3742a4393', '71d5250bbc73b1b6c8433ea97c67efc404c080a7'),
    'kor/column/tuberculosis-children-bcg-latent-guide-2026.html': ('78536f5581f7b834102b6d48f15bf404ceabceca', '118d3e3408bf3f19218faaceb54a8f61df556be1'),
    'kor/column/turtle-trading-strategy-2026.html': ('fbce323507e765c51e87cdc7aca148c4a644302e', '261c75145daa51ddf658f5abd6e7c8ab9971e122'),
    'kor/column/uk-reform-party-2026.html': ('e321b596d3505f6baaddd3e83e6f01c625042c28', '1cac0c6c3eb78e7ca440c7eb9631490de4387713'),
    'kor/column/us-catholic-church-gen-z-trend-2026.html': ('33c1d265862e1d7b9b3359be86158335d79adb97', 'a7a44cd052d549d4777184709be1231d4d1a19d1'),
    'kor/column/us-rate-5pct-survival-2026.html': ('e1b64af26bf833c4770746096665a3f1e5a69919', '0b8836fde2f51cf02820d5b22911506eb0051f90'),
    'kor/column/us-tariff-deal-stock-impact-2026.html': ('167c42ffdd833a1d5616039ef70d02fa54712d9b', 'b9c3fce3df43db1d5f124edeb3125f5fcd93e06c'),
    'kor/column/usa-china-analysis-2026.html': ('2bdd0889c31911539d10f6c86a8518d53f337084', 'b3ca503cfad9b2b2df407a7f47c11f9528c45892'),
    'kor/column/uti-children-symptoms-pediatric-2026.html': ('6550dd957b721d294aa71d92dd82e943c0110d75', '6593cf4aea8f7b26d0144d23636c45d498a0b5e9'),
    'kor/column/warren-buffett-life-wisdom-2026.html': ('c78eefa1b0a8059911235036ec70e21ef8bb6f10', '91b420aa71e293b605c9883152cc0330d8dfe76f'),
    'kor/column/wealth-ladder-maggiulli-2026.html': ('c4990d7f227e5fb4527ea261acfe349df5c0f1c1', '2180d304822271fae03067cc30a7ddcfad7ee84e'),
    'kor/column/weight-control-healthy-aging-2026.html': ('13d8af52b2b6bf022cf423475b1fc683d2a5af69', '4fac64ea96e8b7c50c9e6079e882527664b575c0'),
    'kor/column/where-winds-meet-lv91-howl-canyon-boss-guide-2026.html': ('dfc8ad2645f4442261b9b3a551008bf45244215d', '9967a7c28c7675724b016b6f589c84eecf806dd8'),
    'kor/column/why-nations-invest-in-ai-2026.html': ('59fa7d021a535d80fa9b189a15102d5f59c779c0', '2e5183bd4c584dce2986803a4e528fa7aca44dc3'),
    'kor/column/withcorona-basics-vaccine-mask-guide-2026.html': ('635c40573942611f345640765865590adc83df28', 'e7e4258e06ea2c82353e7bcacd6a5c2b17f7ba85'),
    'kor/column/withcorona-child-language-social-development-2026.html': ('ccc53932f984479da67594b239bd8b0989fc5bc8', '31ec32be92a5506294b988009cba61acb166b78f'),
    'kor/column/won-undervaluation-asia-2026.html': ('c7a2cd4ef8834582971c0c4c9ab4cf98ac7d8087', '99ab99f1520fecae6669ccb510caddb2e608365a'),
    'kor/column/wow-tww-void-tower-dream-rift-raid-guide-2026.html': ('c799725232f99c3fcf95195093e421e75edf7795', '60782a3d07269c2228e1533c06089a2c7297ed29'),
    'kor/column/young-poverty-no-fear-37-rule-2026.html': ('5d3fa462f5fbe4358a0c203916f5f3ad77d383c2', '098254455162d4d2a09ed3815568c8acc9972f13'),
    'kor/column/youtube-content-business-time-capital-2026.html': ('2b452e625277f73ad973ac57814b399c6bb6b297', '3dc5fa50f143aa5d9ec2da9927c8cdb602454af1'),
    'scripts/patch_adsense_slots.py': (None, '62c8f2feac60e72835b34af472213a8deea0da24'),
    'tests/test_patch_adsense_slots.py': (None, '1040c3c2ef279dd12759a91f952e53029d157976'),
    'util/bmi/index.html': ('c3aeeb47dad3c67cd31249f85c750309f3b69c50', 'e25567b2fa8e932d39149f85629b1b28f38e88f1'),
    'util/compound-interest/index.html': ('bc4b141ed61fb3b1c2af1cf6e777c5db4f87f65a', '7015b9ef38219e62fc3cface8e3dffedc48011a5'),
}

MEASUREMENT_WORKFLOW_ALLOWLIST = {".github/workflows/ga4-collection.yml"}
# Owner-reviewed recovery of the existing /kor/report/ destination, 2026-11-05.
# Exact navigation HTML only; articles, altered blobs and all monetization checks remain guarded.
# Evidence: docs/revenue-content-2026-11-05.md (368 existing broken links).
APPROVED_NAVIGATION_HUB_ADDITIONS = {
    "kor/report/index.html": (None, "49525525f01f3c95dbafd19622ba773656928474"),
}

APPROVED_MONETIZATION_ADDITIONS = frozenset({
    ".github/workflows/adsense-collection.yml",
    "scripts/collect_adsense_snapshot.py",
})
APPROVED_PROTECTED_WINNER_TRANSITIONS = {
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v3-suwon-siheung-ansan-cheorwon-2026-10-14.md
    "kor/report/camp/ansan.html": {
        ("0d33716b6dd3e8f9c2f8036f437fb79a13d6eacf", "ed7356cd82ca5a73e54be996ee6e64428da531aa"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v3-suwon-siheung-ansan-cheorwon-2026-10-14.md
    "kor/report/camp/cheorwon.html": {
        ("d12c71cd0cdf1fe69cd290697ac92d3fb88e3b57", "7c85a60c9ea3cd772cec71e0628371f3c036ddca"),
    },
    # Preserve the earlier exact internal-link transition and record the separate fact correction.
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v2-pyeongtaek-gyeonggi-2026-10-14.md
    "kor/report/camp/pyeongtaek.html": {
        ("4d95593169e466447ee355429d2822764ca7e1a5", "b4fc13119f1e8cd01d78805d06ee981ac6834236"),
        ("3fd0e1959b4302b3209d4efc37b872c97aded91e", "0fd88c06441a246aa87ddeb72ba29a5f5fb4d5c1"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v2-pyeongtaek-gyeonggi-2026-10-14.md
    "kor/report/camp/gyeonggi-best.html": {
        ("1166dbea157c13f7664c12055d9b5aabb65edb27", "218dd0469056c432b1dcfccbab54d4dbf38c1769"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v3-suwon-siheung-ansan-cheorwon-2026-10-14.md
    "kor/report/camp/siheung.html": {
        ("0560afa99bee22a561ba52fe156ef68a1e34ffe9", "356dc2a0c9925a5d98b491764f82af181e12a607"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v3-suwon-siheung-ansan-cheorwon-2026-10-14.md
    "kor/report/camp/suwon.html": {
        ("ede5c9273cdacf710908bdc0252e6e99ea404389", "c965b510a9044b50ffaf5b3a9d3a2267157a30e6"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v4-top20-goyang-jinju-nonsan-2026-10-14.md
    "kor/report/camp/jinju.html": {
        ("6cf50dd713dda4d144d1749fa748b9726f7b5427", "bc2da49e0032ec84f458b6fa01ecc51f8bacac9d"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v4-top20-goyang-jinju-nonsan-2026-10-14.md
    "kor/report/camp/nonsan.html": {
        ("2f93f3c4abdf9b77d93d70424d805693481189b9", "a4a84d3175068107255d0661f1a6fc5edefce8bd"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v4-top20-goyang-jinju-nonsan-2026-10-14.md
    "kor/report/camp/goyang.html": {
        ("08b645d8f3a014fb9e4eaf5e3fd1b98ea9375977", "9825bef7a105c317d2e8ef6864d09f39cb98effa"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v4-top20-goyang-jinju-nonsan-2026-10-14.md
    "kor/report/camp/free-camping-top20.html": {
        ("d1c1bb873396962201feb6c19611453abec93190", "9e43505ea55269bd15b40203ac8d87ba2182168c"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v5-paju-boryeong-iksan-sejong-2026-10-14.md
    "kor/report/camp/sejong.html": {
        ("d8b89c2137a5d61b261b8c0c512df84ed127ecbd", "88683b5569912dd2a7cb07c1002dcec1da05c838"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v5-paju-boryeong-iksan-sejong-2026-10-14.md
    "kor/report/camp/paju.html": {
        ("29a9cfca373bd008396d7450ea4dad2bd4da09f6", "6d1f2a222f150c88a00b3ad3bafc1213761a8fe6"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v5-paju-boryeong-iksan-sejong-2026-10-14.md
    "kor/report/camp/boryeong.html": {
        ("bfbe722f3545e3f3d1aebe35cc1cfd5c9a807b68", "8049f09e81190d4cb87d086a80dccb6bb664b938"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v5-paju-boryeong-iksan-sejong-2026-10-14.md
    "kor/report/camp/iksan.html": {
        ("e145697177cdc049889db9dfdb356cad63a358fc", "46bc4a8bb456cf19d6fdf8a13ec04ce6cf84bdbc"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v6-sokcho-gumi-daebudo-buyeo-2026-10-14.md
    "kor/report/camp/daebudo-camping.html": {
        ("a1b43ea83b8bf37071c97498c8250762cab155ec", "8cc86c6618ace2f3f5381a68d28632e4dfc2cd09"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v6-sokcho-gumi-daebudo-buyeo-2026-10-14.md
    "kor/report/camp/sokcho.html": {
        ("20cff46f028466b9ca7ea2f0169ea9a24335d0bd", "7f0dfdf4614388f9d0452fa650135982ef558827"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v6-sokcho-gumi-daebudo-buyeo-2026-10-14.md
    "kor/report/camp/buyeo.html": {
        ("7fc58974db6d37078e48715c7dfb9633bffd60e6", "18bb30fb239d18f251653f47c5a6acc6696b557b"),
    },
    # Official-source fact correction, 2026-10-14; exact blob pair only.
    # Evidence: reports/camp-factcheck-v6-sokcho-gumi-daebudo-buyeo-2026-10-14.md
    "kor/report/camp/gumi.html": {
        ("42694573cb32ba5faa28c8fb65adba8632f74d3d", "8247845770a55743e7c3fa6b923a6d921d2962fa"),
        # 7차 nationwide winter hub reciprocal link; the exact page diff changed no factual claims.
        # Evidence: https://emfls.github.io/kor/report/camp/winter-public-campsites-2026.html
        ("ac2d288245094d8fb884f91f3eac1d1c87b6874a", "3230bfbc1366512bf868eddb3b9809d6afdf00bf"),
    },
    # C33's user-approved factual and policy-integrity repair; the exact blob pair keeps all other edits protected.
    "kor/column/maple-planet-no-capital-rice-farming-2026.html": {
        ("fd73fdd0be12fab17f9ab78473c0182956d34098", "873ab21ba21523a22e83cffaf61e1dab3e4ec5d3"),
    },
    # User-approved rank-23~72 revenue top-ten claim-safety transition, 2026-10-15.
    # Reason: blanket price, permission, popularity, and facility-operation claims lacked page-specific current proof; softened to candidates/checks.
    # Evidence for place-category restrictions: official Nature Parks Act, Article 27.
    "kor/report/camp/jeongeup.html": {("ab1e3262356aed3a0bbaa1261b8ac4ce236bfbbb", "2aa21bb5fe2df98522db391b1ef3b80e77acf7b9")},
    # Reason: no official source confirmed permission for the riverside day-use claims; softened and cooking permission must be checked.
    # Official registered-campsite directory: https://www.gocamping.or.kr/
    "kor/report/camp/naju.html": {("5d0bbd9034e8ec5e23a23f4bcded152e206e75af", "dd487c6c8ef607705d201fa2310c0f5c1febc657")},
    # Reason: public parking use is not camping permission; exact conditional caveat cites Parking Act Article 6-3.
    # Evidence: https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030692303
    "kor/report/camp/jeongseon.html": {("123b15dd9f20251dd39963980521901140f06c5b", "45ce7fd27c043ce0633e0444d77b752cabbe3782")},
    # Reason: unsupported free-use and facility-operation guarantees were recast as candidates/checks.
    # Official registered-campsite directory: https://www.gocamping.or.kr/
    "kor/report/camp/gimhae.html": {("05cd885ece332aeda44d7e62315c74f2b3c140b3", "bb9c8901f0c0157a362db5f7ad46bd477e809308")},
    # Reason: unsupported riverside and facility guarantees were softened; registered facilities remain identifiable.
    # Official registered-campsite directory: https://www.gocamping.or.kr/
    "kor/report/camp/imsil.html": {("6170c38cbf7172e5ae49eebdcca2a7b8e5df5818", "ea707753aa03c0ab375483657b9b445a7b1f59be")},
    # Reason: public-park parking and camping are distinct; unsupported access claims were softened.
    # Evidence: https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030692303
    "kor/report/camp/hanam.html": {("29e134192f8374b4717762fd1af649f9db693c91", "be7b1f40498e32b3cce1d3f8aa280608aaae53ab")},
    # Reason: public parking and unregistered riverside camping claims were reframed as candidates/checks.
    # Evidence: https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030692303
    "kor/report/camp/mungyeong.html": {("acd2dba287f933dd9d9f205842343f33495fa346", "23711e091b048deac5f4a0ae13b06b47be3fb01a")},
    # Reason: Sobaeksan national park camping is limited to designated locations; operation statements now require official confirmation.
    # Evidence: https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1016596485
    "kor/report/camp/yeongju.html": {("c685ec7abe886b21b8c8bedf1732dfda9f3a7c45", "3f99ce18ef9375d1af3f82eb8d6ed4c26f3d1599")},
    # Reason: park/parking and facility claims were softened; national park and public parking restrictions are linked.
    # Evidence: https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1016596485 ; https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030692303
    "kor/report/camp/danyang.html": {("dce1faa5116434176c59b691527c60703ea26439", "c4c707b5930eff43cf2a6d3a54a310106f8bbd17")},
    # Reason: remove unsupported beach/shore popularity, free-use, and permission claims; retain conditional designated-place notices.
    # Evidence: Beach Act Article 22 https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033791203 ; Parking Act Article 6-3 https://www.law.go.kr/법령/주차장법/제6조의3
    "kor/report/camp/gunsan.html": {("c4b8dacf33b1bd6d9142f2c0428784b814c065af", "064e5328caa5e3ff6b0e319574c71d4b798f5099")},
}

# [8차] Exact protected-WINNER transitions for reviewed claim softening and winter facts, 2026-10-15.
# Reason: only these explicitly reviewed pages changed. Unsafe camping/facility guarantees were qualified;
# local pages now match the 2026-09-29 KNPS winter operation notice or the linked Foresttrip notice.
# Evidence: Notion instruction [8차] (3f9db4c0a991818294e9f6f2339d0a80), approved draft 16차,
# KNPS notice seq=29193, and Foresttrip Gari-san official page. Exact blob pairs only; QA remains enabled.
APPROVED_TASK8_PROTECTED_TRANSITIONS = {
    "kor/report/camp/jeongeup.html": ("2aa21bb5fe2df98522db391b1ef3b80e77acf7b9", "22e1bb559dbc1b22916e4c0aaa7cc6b5077cfc06"),
    "kor/report/camp/chilgok.html": ("d556f15ca025ec8f27d72403cd11c55fa821b88c", "dd3f8a561ff549fce007514e1908b58af351e7fb"),
    "kor/report/camp/mungyeong.html": ("23711e091b048deac5f4a0ae13b06b47be3fb01a", "13fe81db50b57f1a569b852649d7b0521cc857e7"),
    "kor/report/camp/tongyeong.html": ("f40f8e7b1f59e7a99df1d6aec282ccdd4edb9c2e", "5ef906eef4c4cecd6d33548d1fdb0d956f4b0292"),
    "kor/report/camp/miryang.html": ("d9931bcb76f5a2ad14d50f4ffe34bebb6c7f95a7", "cd5eb8e946c3dda2fe6352b93fdf5b351861077f"),
    "kor/report/camp/gyeryong.html": ("3c799ed6a98f9250d322f6e13076ca09e2da9558", "12bb2658bf403251027828854d26d9cddd5cc61f"),
    "kor/report/camp/suncheon.html": ("03febec926594a6570b6b8c0397ada640fee7b95", "2d5f4b37405f4c824f3513a99a9d208a6905158b"),
    "kor/report/camp/hongcheon.html": ("174f2cd7b24db6e2aba624021a31ca8e4c36352a", "b29334ecff8e07e730c984f7c376600629c35562"),
    "kor/report/camp/yeongju.html": ("3f99ce18ef9375d1af3f82eb8d6ed4c26f3d1599", "cb19f4f199a7bd0fd23992f678133d1020b2e6cb"),
    "kor/report/camp/seongju.html": ("4bb4f72be5883e43f432d542e0b4df9621812f08", "e55c11cb4c3ecf88f32f6587072e46700c46693a"),
}
for _path, _pair in APPROVED_TASK8_PROTECTED_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_pair)

# [9차] Official-source fact corrections, 2026-10-15; exact blob pairs only.
# Evidence: Notion 17차/18차 accepted official-source fact-check results; page-specific transition reason recorded below.
APPROVED_TASK9_PROTECTED_TRANSITIONS = {
    # chilgok: user-directed official fact correction; no ads, GA4, canonical URL, or route changes.
    # Evidence: https://app.notion.com/p/3f9db4c0a99181358dacf91b7ae41eb5
    "kor/report/camp/chilgok.html": ("d556f15ca025ec8f27d72403cd11c55fa821b88c", "6873a0b9eed042519d6d53e1e02599fff75f778e"),

    # tongyeong: user-directed official fact correction; no ads, GA4, canonical URL, or route changes.
    # Evidence: https://app.notion.com/p/3f9db4c0a99181358dacf91b7ae41eb5
    "kor/report/camp/tongyeong.html": ("5ef906eef4c4cecd6d33548d1fdb0d956f4b0292", "236df7181ddba7a8b514509dac4ebb374a01e6f9"),

    # miryang: user-directed official fact correction; no ads, GA4, canonical URL, or route changes.
    # Evidence: https://app.notion.com/p/3f9db4c0a99181358dacf91b7ae41eb5
    "kor/report/camp/miryang.html": ("cd5eb8e946c3dda2fe6352b93fdf5b351861077f", "f6d26d823f02495af4060b6f06b3aef5b154fd0e"),

    # gyeryong: user-directed official fact correction; no ads, GA4, canonical URL, or route changes.
    # Evidence: https://app.notion.com/p/3f9db4c0a99181358dacf91b7ae41eb5
    "kor/report/camp/gyeryong.html": ("12bb2658bf403251027828854d26d9cddd5cc61f", "cbd239aeca7ed4fccd17eda904d71bfa35ab5352"),

    # suncheon: user-directed official fact correction; no ads, GA4, canonical URL, or route changes.
    # Evidence: https://app.notion.com/p/3f9db4c0a99181358dacf91b7ae41eb5
    "kor/report/camp/suncheon.html": ("2d5f4b37405f4c824f3513a99a9d208a6905158b", "750183eb0ddfa1efe6282c01ab494a52152a1532"),

    # jeongeup: user-directed official fact correction; no ads, GA4, canonical URL, or route changes.
    # Evidence: https://app.notion.com/p/3f9db4c0a99181eb8153ecaa339536fe
    "kor/report/camp/jeongeup.html": ("22e1bb559dbc1b22916e4c0aaa7cc6b5077cfc06", "b84fe432e8b1e0d5181fb24b1ba8947093c4a7f3"),

    # naju: user-directed official fact correction; no ads, GA4, canonical URL, or route changes.
    # Evidence: https://app.notion.com/p/3f9db4c0a99181eb8153ecaa339536fe
    "kor/report/camp/naju.html": ("dd487c6c8ef607705d201fa2310c0f5c1febc657", "d81177785d617cb18796162b290e13035bd53e2f"),

    # jeongseon: user-directed official fact correction; no ads, GA4, canonical URL, or route changes.
    # Evidence: https://app.notion.com/p/3f9db4c0a99181eb8153ecaa339536fe
    "kor/report/camp/jeongseon.html": ("45ce7fd27c043ce0633e0444d77b752cabbe3782", "fc00ce907b0150a640c40e3a1d40427a015cdd1b"),

    # gimhae: user-directed official fact correction; no ads, GA4, canonical URL, or route changes.
    # Evidence: https://app.notion.com/p/3f9db4c0a99181eb8153ecaa339536fe
    "kor/report/camp/gimhae.html": ("bb9c8901f0c0157a362db5f7ad46bd477e809308", "13c933afd940088bd17ac78280401249200fb4fe"),

    # imsil: user-directed official fact correction; no ads, GA4, canonical URL, or route changes.
    # Evidence: https://app.notion.com/p/3f9db4c0a99181eb8153ecaa339536fe
    "kor/report/camp/imsil.html": ("ea707753aa03c0ab375483657b9b445a7b1f59be", "338c7f333ead58ec6df42dad01097bac8cee5db6"),

}
for _path, _blob_pair in APPROVED_TASK9_PROTECTED_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# [10차] Official-source fact corrections, 2026-10-15; exact origin/main→HEAD blob pairs only.
# Reason: user-directed P0/P1 corrections accepted from Notion 19차; only those five protected
# pages are approved. Ads, GA4, canonical URLs, and routes remain unchanged; all guard checks stay enabled.
# Evidence: https://app.notion.com/p/3f9db4c0a99181fbb340dea80a3e158e
APPROVED_TASK10_PROTECTED_TRANSITIONS = {
    "kor/report/camp/hanam.html": ("be7b1f40498e32b3cce1d3f8aa280608aaae53ab", "cf48be7802004da8d63aa878ca4b661a1247fc73"),
    "kor/report/camp/mungyeong.html": ("13fe81db50b57f1a569b852649d7b0521cc857e7", "8b3eb7082cd0259f1892592778ccf45ed194a081"),
    "kor/report/camp/yeongju.html": ("cb19f4f199a7bd0fd23992f678133d1020b2e6cb", "b11ec5bf666e5cea6719cd5d5138fb396e24f5e8"),
    "kor/report/camp/danyang.html": ("c4c707b5930eff43cf2a6d3a54a310106f8bbd17", "c7d3b26a0ece8ded640c046ba251137f5300bf79"),
    "kor/report/camp/gunsan.html": ("064e5328caa5e3ff6b0e319574c71d4b798f5099", "e53cff80bd837caafea6d5b5e6429960a135364a"),
}
for _path, _blob_pair in APPROVED_TASK10_PROTECTED_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# [11차] Official-source fact corrections for five camp pages, 2026-10-15.
# Reason: user-directed P0 and accepted P1 corrections from Notion [20차]; exact origin/main→HEAD blob pairs only.
# Ads, GA4, canonical URLs, and routes remain unchanged; all protection checks stay enabled.
# Evidence: https://app.notion.com/p/3fadb4c0a99181f28151d6dfe25c1987
APPROVED_TASK11_PROTECTED_TRANSITIONS = {
    "kor/report/camp/jangheung.html": ("db7025270b3ecf11aed10f079478a200090926c2", "0e584a4d106e7e93d82e28b0decc50bc67aa9970"),
    "kor/report/camp/jangsu.html": ("dda549d6d57254b36d2d2b0aa5ad19657ca95cb2", "eca0a2d7195526c7ef054d2c6bae0bf3d3c236a7"),
    "kor/report/camp/haman.html": ("59e0a26d2a8a087a99cdde4d26a17f4422de3acb", "e7abb4984a9e911103b3152cc54ad030abdbbdcb"),
    "kor/report/camp/jindo.html": ("17d6c275e1f78d21be71f2acb6961fe58081b740", "104ee22b5ced0c27d6027be9519560ab481fe23c"),
    "kor/report/camp/changwon.html": ("c0f1c7df88fa1b5a99b6824f915716f0f2f61b54", "23476048990aae92b4a870d49c9e0518643430f6"),
}
for _path, _blob_pair in APPROVED_TASK11_PROTECTED_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# [11차 보완] Exact Jindo follow-up for the accepted 2026-09-29 KNPS winter notice.
# Reason: the adopted P1 requires separating park-wide campsite season labels from Gwanmaedo's unverified local permission.
# Evidence: Notion [20차] and [12-보완]; no URL, ads, GA4, or other page is approved by this transition.
APPROVED_TASK11_FOLLOWUP_PROTECTED_TRANSITIONS = {
    "kor/report/camp/jindo.html": ("104ee22b5ced0c27d6027be9519560ab481fe23c", "f1dffcdda87e644d9de17b902170e99cdd1be2b3"),
}
for _path, _blob_pair in APPROVED_TASK11_FOLLOWUP_PROTECTED_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# [12차] Official-source fact corrections for five protected camp pages, 2026-10-15.
# Reason: user-directed P0 and accepted P1 corrections from Notion [12차] and the adopted [21차] review;
# winter facility details follow the official [12-보완] evidence. Exact origin/main→page blob pairs only.
# No canonical URL, route, AdSense, or GA4 changes are included; every Launch Guard check remains active.
# Evidence: https://app.notion.com/p/3fadb4c0a99181e8a564d8f44c77f10b ;
# https://app.notion.com/p/3fadb4c0a9918115abb1cb1651ca97ea ; https://app.notion.com/p/3f9db4c0a991818db751eac34edf82ae
APPROVED_TASK12_PROTECTED_TRANSITIONS = {
    "kor/report/camp/okcheon.html": ("4033840ca91635899ff111630d1a2e1ca0a29385", "8391f02f02022845e87ce6dc93aa0fbf73104fb5"),
    "kor/report/camp/uiryeong.html": ("aedec20d8aa96bc06a48dfc65883320506711b4f", "421e8087b966d8e626fed120ecfbb5fdf8180942"),
    "kor/report/camp/bonghwa.html": ("76b7b5cafe1a3844e159abda0065ffdc5ff616be", "2a8f3bf9217f8d48e854eeed8f39dccd595460a3"),
    "kor/report/camp/yeongyang.html": ("82d2b9975e02b1930519d39bab0c9ba75febcee7", "67f67d3b49e7495015a188ed1f054dd5417cf3e5"),
    "kor/report/camp/chungcheong-camping-best.html": ("8221a02264b4f5c83971b79bba68de096f49bc0e", "ec9a98783358a0006f2e4492d340200c5f431554"),
}
for _path, _blob_pair in APPROVED_TASK12_PROTECTED_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# [13차] Official-source fact corrections for five protected camp pages, 2026-10-15.
# Reason: user-directed P0 and accepted P1 corrections from Notion [13차], using the adopted [22차] review.
# Only these exact origin/main→page blob transitions are approved; routes, ads, and GA4 remain protected.
# Evidence: https://app.notion.com/p/3fadb4c0a9918155846ee8846a06d90d ;
# https://app.notion.com/p/3fadb4c0a9918112a461fc2172a1e5ab
APPROVED_TASK13_PROTECTED_TRANSITIONS = {
    "kor/report/camp/buan.html": ("9e3c31e74064298bae1f6545dd7aa1cf72781246", "b1619d640ec43c3999bd688b00e280b5908954fe"),
    "kor/report/camp/mokpo.html": ("f66e9c3be4e1eb22cc2d2fd0f8d2575e5e3f7faa", "cb3db11854a967112e4c06f1bfd43f9f1378bfe7"),
    "kor/report/camp/dangjin.html": ("abb2ec5d91ed8f8f89f3ebfd7368f5a1afde5590", "4c7976b4f7a006c43fc15839f60c5f8e2414953b"),
    "kor/report/camp/jeungpyeong.html": ("8dee82eb4e5c56846cefe9aecf2414da70e4790c", "0b08523b659a3729839feef10831b38fec6498cf"),
    "kor/report/camp/namyangju.html": ("d13b0802c28b8ef2ae58fde3e73f1440936ea695", "064a4ae5de8056d5055601f844044da9748ef9f1"),
}
for _path, _blob_pair in APPROVED_TASK13_PROTECTED_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# [14차] User-directed official-source fact corrections for five protected camp pages, 2026-10-15.
# Reason: correct venue categories and operating facts from the accepted 23차 evidence; no route, AdSense, or GA4 changes.
# Evidence: https://app.notion.com/p/3fadb4c0a99181bbb324e4fdf1f02903 and https://app.notion.com/p/3fadb4c0a99181908bb2fa6c43e63499
APPROVED_TASK14_PROTECTED_TRANSITIONS = {
    "kor/report/camp/hadong.html": ("bb4bcdcf3b36d5e5b438e7e6037b67755fc8936a", "657f6e582de5743f5bf922b61558397baac3e532"),
    "kor/report/camp/sejong.html": ("4e18446e475822c4b2f8ae606310f94c1165be11", "dc9e6e586c5af2d23544b1c43da6d0ae8d11fa62"),
    "kor/report/camp/buyeo.html": ("a56f0955dddecf0f3ded1daf92f3e0d37340fbd8", "6634fea5f205584ff924ea5b4e4c7b91f5e1b9b1"),
    "kor/report/camp/boryeong.html": ("aed9f125db1bf01030e1d67f70a6d9872555dc55", "9b6994950f792f80952f639ccfafcbe364d3cb0e"),
    "kor/report/camp/seocheon.html": ("55b8b998d824a47c52ac2b4282591ffb35e436ce", "918276ee50de015ee0e6d0c7ed2b95569d0dadaa"),
}
for _path, _blob_pair in APPROVED_TASK14_PROTECTED_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# [15차] User-directed official-source corrections for five camp pages plus the Dangjin winter-notice follow-up, 2026-10-16.
# Reason: apply accepted P0/P1 findings from Notion [15차]/[24차] and verify the [13차] winter supplement.
# Approve only these exact origin/main→page blob pairs; canonical URLs, AdSense, GA4, and all guard checks remain unchanged.
# Evidence: https://app.notion.com/p/3fadb4c0a99181e7b595edf4daa31788 ;
# https://app.notion.com/p/3fadb4c0a9918180ac93c7b6e4143df6 ; https://reservation.knps.or.kr/community/board/notice/boardDetail.do?seq=29193
APPROVED_TASK15_PROTECTED_TRANSITIONS = {
    "kor/report/camp/gumi.html": ("3230bfbc1366512bf868eddb3b9809d6afdf00bf", "72540c782ce2719d926c75003b97f58f849a55ce"),
    "kor/report/camp/jangseong.html": ("a88adaf07ccd6df2817e8e2766d67f1ab9203edb", "b92bf0ada715e80756dc9ebcf30458ca6246c1a0"),
    "kor/report/camp/gunpo.html": ("52171867915d2b3f8d1bd7820cc95e607f1b7416", "cf3aa68c1015a2bb72c9a89cc0811cd35c3273f4"),
    "kor/report/camp/daebudo-camping.html": ("e889bc4380855684650b311ef1583eafaeea6cc9", "dc0694d3fe28c3c1da7a2fbb66851c20a6ef9325"),
    "kor/report/camp/gimpo.html": ("3f4bb92dadada5563d2bff0338b8ba56d98e8ddf", "48d621257ed6866f6535f1c95dbe127c32d864df"),
    "kor/report/camp/dangjin.html": ("4c7976b4f7a006c43fc15839f60c5f8e2414953b", "25fb6fe9af78732c25f1c2dc10d0a15c887c6b72"),
}
for _path, _blob_pair in APPROVED_TASK15_PROTECTED_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Owner-delegated official-source camping/travel improvements, 2026-11-05.
# Evidence and full before/after patch: docs/revenue-content-2026-11-05.md.
# Exact blobs only; all WINNER, experiment, deletion and monetization checks stay active.
APPROVED_NOVEMBER_5_CONTENT_TRANSITIONS = {
    "kor/report/camp/gyeonggi-best.html": ("61d94655410ddb7e621cedc66c24098bd064b5b6", "4ba21616b89fd1bef0a23b44ffebc355bff5b55c"),
    "kor/report/camp/pyeongtaek.html": ("17c6310bd6ada1388163ba51f514a34a012f1c6e", "b631bae28b4017f5d5ace5932557869ff4d1d090"),
    "kor/report/travel/korean-souvenir-foreigners-2026.html": ('07262385d87ab2da932427b013ba9c5a0328d8e3', 'de0396fdbb36bd9742256902033a8d02057ff2f7'),
}
for _path, _blob_pair in APPROVED_NOVEMBER_5_CONTENT_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Owner-delegated expired-notice and booking-condition repair; exact version only.
# Evidence: docs/iksan-notice-repair-2026-11-08.md. OBSERVING checks remain active.
APPROVED_IKSAN_NOTICE_REPAIR_20261108 = {
    "kor/report/camp/iksan.html": ("4eb037ae2a287d68c9c3c8a241544599d57b69b3", "4605e779e53a2e36217c7ead32436839e1d8f960"),
}
for _path, _blob_pair in APPROVED_IKSAN_NOTICE_REPAIR_20261108.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Existing mobile-reader booking repairs under the owner's November 8 delegation.
# Exact reviewed versions; docs/mobile-camping-booking-recovery-2026-11-08.md.
APPROVED_MOBILE_CAMPING_BOOKING_20261108 = {
    "kor/report/camp/sejong.html": ("53d89a2bdb4c089709b86c39164ddbcbcaf99aa3", "ffdc657cf2a771ca08f4cdead9d0181b305f4ce2"),
    "kor/report/camp/boryeong.html": ("6e980d69f539b42661a4dcf69ad1588807f2de29", "5b4f133583feabea7dc3b466a0407a8819b98671"),
    "kor/report/camp/naju.html": ("6d5beddfe111bdb3b627ad4a126151271ec88a88", "9598b42e60fff56344805d93770a3f6dc638040f"),
}
for _path, _blob_pair in APPROVED_MOBILE_CAMPING_BOOKING_20261108.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Owner-delegated verified Ansan booking answer; exact reviewed version only.
# Evidence: docs/ansan-booking-recovery-2026-11-08.md; experiment gates stay active.
APPROVED_ANSAN_BOOKING_20261108 = {
    "kor/report/camp/ansan.html": ("b4716ebb255a7a4b4815361158b342a0cdbc4d14", "a278b6da758135bac5ad3f53c0ccef931c63d6cf"),
}
for _path, _blob_pair in APPROVED_ANSAN_BOOKING_20261108.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Follow-up publisher home-button occlusion reproduced on public Ansan at 390px.
APPROVED_ANSAN_HOME_FLOW_20261108 = {
    "kor/report/camp/ansan.html": ("a278b6da758135bac5ad3f53c0ccef931c63d6cf", "63f48ca998c0ee01e40202fab83fe531f1a6f725"),
}
for _path, _blob_pair in APPROVED_ANSAN_HOME_FLOW_20261108.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Measured Maple reader repair under the November 8 owner delegation; exact blobs.
# docs/maple-reader-recovery-2026-11-08.md; observing/cooldown gates remain active.
APPROVED_MAPLE_READER_20261108 = {
    "kor/column/maple-planet-bishop-4th-skill-quest-guide-2026.html": ("311260d8f5592fa0d534624349fef5e3252a55ad", "91a8e3b888091f427511ff5caca129a5bdcde58c"),
    "kor/column/maple-planet-no-capital-rice-farming-2026.html": ("873ab21ba21523a22e83cffaf61e1dab3e4ec5d3", "7bf0825aa5a1fa2d1a61545031fb8e4285adf74c"),
    "kor/column/mapleland-bishop-free-leveling-guide-2026.html": ("33321d79ea9f2cf35bad23357db8f95ec535cab4", "7fea9eb7f94f7c12b5258f6a77d9d0f83604111a"),
}
for _path, _blob_pair in APPROVED_MAPLE_READER_20261108.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Existing eSIM calculator repair under the owner delegation; exact versions only.
# docs/esim-search-recovery-2026-11-08.md; experiment and cooldown gates remain active.
APPROVED_ESIM_SEARCH_20261108 = {
    "kor/util/japan-esim-data-calculator/index.html": (
        "993c7610169b2d10c4f111929d2fa330d901d040",
        "010557d00c6d82db4c5477e39e4a7f0624e73265"
    ),
    "kor/util/japan-esim-data-calculator/app.js": (
        "562d0d3ba429e1df9258ff7e379496ff84e28aa8",
        "57a746dc2cd6b8a2059f3a017a8a865d6999818a"
    )
}
for _path, _blob_pair in APPROVED_ESIM_SEARCH_20261108.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(tuple(_blob_pair))

# Verified Gimpo booking access under the owner delegation; no observation override.
# docs/gimpo-booking-answer-2026-11-08.md records the exact review and source limits.
APPROVED_GIMPO_BOOKING_20261108 = {
    "kor/report/camp/gimpo.html": ("f2bb1fe4d849831bd7cdfec2fd2ca0860a312c0a", "de4cf2fa3dcf6f3b889ffecf475225acaac47fdf"),
}
for _path, _blob_pair in APPROVED_GIMPO_BOOKING_20261108.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Homepage search recovery under the owner delegation; exact versions only.
# docs/home-search-recovery-2026-11-08.md; observation gates remain active.
APPROVED_HOME_SEARCH_20261108 = {
    "index.html": ("f83c43f37a66792c8f983c8901ca57b3bab79e82", "4e5ea704995ec67d6516e01b6de6f90db775bb4c"),
}
for _path, _blob_pair in APPROVED_HOME_SEARCH_20261108.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Readable homepage search cards, including hover; separately frozen visual repair.
APPROVED_HOME_SEARCH_CONTRAST_20261108 = {
    "index.html": ("4e5ea704995ec67d6516e01b6de6f90db775bb4c", "e028aa2ccf40412cf9fa1d476ea6d2bae3a45af1"),
}
for _path, _blob_pair in APPROVED_HOME_SEARCH_CONTRAST_20261108.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Existing equipment guide's optional reader paths; owner delegation, exact versions only.
# docs/maple-equipment-reader-path-2026-11-08.md; no experiment override.
APPROVED_MAPLE_EQUIPMENT_PATH_20261108 = {
    "kor/column/maple-planet-equip-setup-guide-2026.html": ("eee2813e285e284fc2ff03efdc412f2489571288", "ae1714d2c486f7037b087432bc4060aa75e20b0e"),
}
for _path, _blob_pair in APPROVED_MAPLE_EQUIPMENT_PATH_20261108.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Microsoft-sourced installation guidance in PR #555.
APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault("kor/report/window/windows11-installation-failure-fix.html", set()).add(
    ("416d5020eaef44105ef0a82627b5254da9533b23", "a3e7e45340aae403219d3b133b0b66b0db6820d5")
)

# Boeun campground booking facts reviewed in PR #551.
APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault("kor/report/camp/boeun.html", set()).add(
    ("6b2e855305a914627904e73188cdcbba5c8bb79d", "0bbed5e589902264d2046d58e92201436e071d66")
)

# Jeju reservation links and official Hallasan rules reviewed in PR #571.
APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault("kor/report/camp/jeju-camping-best.html", set()).add(
    ("66dd8913a913378f9d823a634c70ee412962869c", "19f69265ba34d9c00b973e376100c10b63edb53c")
)

# Official-source corrections for the three protected guides in PR #574.
APPROVED_NOVEMBER_7_NAVER_TRANSITIONS = {
    "kor/column/imjin-war-joseon-character-growth-guide-2026.html": ("8eef4d479bb11756837ea4fb7c6a75a7bbb52427", "9f453f43fc21826e9bc5faea1ccc573226fd6444"),
    "kor/report/camp/choenan.html": ("2935381bf3aa47932c8a6580884f99d979615043", "83adb0d7f6ffb91e2e1f712e6de464fc86d16140"),
    "kor/report/window/windows11-start-menu-windows10-style.html": ("43ce883a2389e7e95e44e25127c726d090eab547", "fd300d7198ca5ce3059b8c1beba38c273c6fdc07"),
}
for _path, _blob_pair in APPROVED_NOVEMBER_7_NAVER_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Owner-delegated next-reading navigation on four existing revenue pages, 2026-11-05.
# Evidence and full diff: docs/revenue-reader-paths-2026-11-05.md; exact blobs only.
APPROVED_READER_PATH_TRANSITIONS_20261105 = {
    "kor/report/camp/gyeonggi-best.html": ("4ba21616b89fd1bef0a23b44ffebc355bff5b55c", "2d0a4ff260f49571c41bf6f1ef550fe5c6980749"),
    "kor/report/camp/pyeongtaek.html": ("b631bae28b4017f5d5ace5932557869ff4d1d090", "9e5a63ab577bd29a3b75c993e48062b574082f6b"),
    "kor/report/camp/cheorwon.html": ("c1aadf2a33f1865ada29aa277a351347ed18b18d", "09dca99bf5db9969f37b57cf2bc3dac15ec82e55"),
    "kor/report/camp/jeongseon.html": ("e91280a85c6939d3be02808287773c4cab5cd495", "102a6320e3f8f29c61fdd361d4502ce3385ee5b1"),
}
for _path, _blob_pair in APPROVED_READER_PATH_TRANSITIONS_20261105.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Exact campground guidance and official booking versions reviewed in PR #581.
APPROVED_CAMPING_GUIDANCE_TRANSITIONS_20261107 = {
    "kor/report/camp/index.html": ("0004ec0cf70327c431b5a04a39057b787ea39748", "801b3c69aa69889de8a5b676aea6cade2c5eaea1"),
    "kor/report/camp/jeongeup.html": ("d8cc4c9ebb5dcdbd00d8471881aaadb53171dc30", "54f92bfc07767fd5fb6bfc37d2d73919341f2a92"),
}
for _path, _blob_pair in APPROVED_CAMPING_GUIDANCE_TRANSITIONS_20261107.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# User approved this exact QR image-reader repair and normal release on 2026-11-07.
APPROVED_QR_IMAGE_READER_TRANSITIONS_20261107 = {
    "util/qrcode/index.html": ("6463855d25193eec0de68bd005b2c6023c6c706f", "3c6b52474b286a17856c232fe09334183052a138"),
}
for _path, _blob_pair in APPROVED_QR_IMAGE_READER_TRANSITIONS_20261107.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Owner-delegated batch: exact dice recovery and official Jinju facility comparison.
APPROVED_UTILITY_CONTENT_REPAIRS_20261107 = {
    "util/dice3d/index.html": ("887b501ae434026819e122547e338c7e9bc60479", "af2475c7a99ab1d7eea7836c796446d8a6874d2a"),
    "kor/report/camp/jinju.html": ("6f9706cfdc9bc23db2e75df806bf5fd9806b4a04", "52c0fc468ceeea9a6ab99528622b508dcbb37254"),
}
for _path, _blob_pair in APPROVED_UTILITY_CONTENT_REPAIRS_20261107.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Exact owner-delegated Suwon booking and Siheung fee/arrival repairs, 2026-11-07.
APPROVED_CAMP_MOBILE_REPAIRS_20261107 = {
    "kor/report/camp/suwon.html": ("ab537b9e6df215abf86290a0074b51d5ca1ff89d", "af4c894588719175bb835f76b7b8befe18a53d93"),
    "kor/report/camp/siheung.html": ("28d8cf9cc4d6f3e91ecffabc5c9ff0234ede7968", "ab2c7489a2e7a9f4223a68f625b9f9823da900eb"),
}
for _path, _blob_pair in APPROVED_CAMP_MOBILE_REPAIRS_20261107.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Owner-authorized top-anchor occlusion repair; official bottom-only loader option.
APPROVED_BOTTOM_ANCHOR_TRANSITIONS_20261107 = {
    'kor/report/camp/suwon.html': ('af4c894588719175bb835f76b7b8befe18a53d93', 'f25c43067a1fe88dc64ec4166deb64bc40efaf06'),
    'kor/report/camp/siheung.html': ('ab2c7489a2e7a9f4223a68f625b9f9823da900eb', 'e29e3327dbf0a247e5ef05aad517502483889130'),
}
for _path, _blob_pair in APPROVED_BOTTOM_ANCHOR_TRANSITIONS_20261107.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# Exact publisher-navigation flow repair after a confirmed reservation-link overlap.
APPROVED_CAMP_HOME_FLOW_TRANSITIONS_20261107 = {'kor/report/camp/suwon.html': ('f25c43067a1fe88dc64ec4166deb64bc40efaf06', 'e23d6dc419279c375951906e661481dd3769b651'), 'kor/report/camp/siheung.html': ('e29e3327dbf0a247e5ef05aad517502483889130', '70a331f666df05ec5c3700fd056c20630d83a94c')}
for _path, _blob_pair in APPROVED_CAMP_HOME_FLOW_TRANSITIONS_20261107.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

# User-approved AdSense placement on the 29-day top-30 camping pages, 2026-10-14.
# Evidence: reports/camp-cluster-inventory-2026-10-14.csv; exact blob pairs only.
APPROVED_AD_PLACEMENT_TRANSITIONS = {
    'kor/report/camp/gyeonggi-best.html': {('218dd0469056c432b1dcfccbab54d4dbf38c1769', 'ac9c428f4f76555644ffa41c7a710d7448fbff73')},
    'kor/report/camp/pyeongtaek.html': {('0fd88c06441a246aa87ddeb72ba29a5f5fb4d5c1', 'c2fb69df21a9c41340e74e87c2daca409fa54e7b')},
    'kor/report/camp/suwon.html': {('c965b510a9044b50ffaf5b3a9d3a2267157a30e6', '3471e4138ddb05a4f7c18380a4e2b251d9dcc586')},
    'kor/report/camp/siheung.html': {('356dc2a0c9925a5d98b491764f82af181e12a607', 'ea621df5aeef350912cfdbb3a1eea619928afeb2')},
    'kor/report/camp/ansan.html': {('ed7356cd82ca5a73e54be996ee6e64428da531aa', '6c5eaf5b69d6a045ba3985b580eafdf56d296c17')},
    'kor/report/camp/cheorwon.html': {('7c85a60c9ea3cd772cec71e0628371f3c036ddca', '9c4619bc59e69d0bf5fbaa35891f230a03fad117')},
    'kor/report/camp/free-camping-top20.html': {('9e43505ea55269bd15b40203ac8d87ba2182168c', 'd3a9915ffc63af8100ed5e7145dc467509224c2e')},
    'kor/report/camp/goyang.html': {('9825bef7a105c317d2e8ef6864d09f39cb98effa', '2bb3c477d8552d193a8afc6ffcc304bcb84c1567')},
    'kor/report/camp/jinju.html': {('bc2da49e0032ec84f458b6fa01ecc51f8bacac9d', '5c823348f2ef2f4557330c53e54f167685d63bf5')},
    'kor/report/camp/nonsan.html': {('a4a84d3175068107255d0661f1a6fc5edefce8bd', 'dc0bf2e94bec31008ff56cc6a415c89669bd1595')},
    'kor/report/camp/paju.html': {('6d1f2a222f150c88a00b3ad3bafc1213761a8fe6', '470d5b87afa8a7fb1f97006f683c596c0affba7e')},
    'kor/report/camp/boryeong.html': {('8049f09e81190d4cb87d086a80dccb6bb664b938', 'aed9f125db1bf01030e1d67f70a6d9872555dc55')},
    'kor/report/camp/iksan.html': {('46bc4a8bb456cf19d6fdf8a13ec04ce6cf84bdbc', 'd99e879e2995031023cc38f5e4a8af7eca295010')},
    'kor/report/camp/sejong.html': {('88683b5569912dd2a7cb07c1002dcec1da05c838', 'a572cef85b094d06318bf4fb4e914b73a6cf60eb')},
    'kor/report/camp/sokcho.html': {('7f0dfdf4614388f9d0452fa650135982ef558827', '131f6c7a76fb346a5040550c8a4a1515da635897')},
    'kor/report/camp/gumi.html': {('8247845770a55743e7c3fa6b923a6d921d2962fa', 'ac2d288245094d8fb884f91f3eac1d1c87b6874a')},
    'kor/report/camp/daebudo-camping.html': {('8cc86c6618ace2f3f5381a68d28632e4dfc2cd09', 'e889bc4380855684650b311ef1583eafaeea6cc9')},
    'kor/report/camp/buyeo.html': {('18bb30fb239d18f251653f47c5a6acc6696b557b', 'a56f0955dddecf0f3ded1daf92f3e0d37340fbd8')},
    'kor/report/camp/hadong.html': {('8052b7f3fa4ac3f6d3eaa7b441aac9595d91e3d9', 'bb4bcdcf3b36d5e5b438e7e6037b67755fc8936a')},
    'kor/report/camp/seocheon.html': {('742c8944bed3c136d1e10a7b46f2d833d067fc68', '55b8b998d824a47c52ac2b4282591ffb35e436ce')},
    'kor/report/camp/jangseong.html': {('ddc0536200386f0cfbffb72e3cec499e7cc04e3f', 'a88adaf07ccd6df2817e8e2766d67f1ab9203edb')},
    'kor/report/camp/gunpo.html': {('66ebaeb7592dd0158fc7a1039ed9d5cbd88e1f2a', '10f32db492341b9f45cdbd77ea0a9b670dec4095')},
    'kor/report/camp/jeongseon.html': {('9debf037ce21be8f5b58bf45e2efd78c049e7151', '123b15dd9f20251dd39963980521901140f06c5b')},
    'kor/report/camp/chungcheong-camping-best.html': {('0d72e2d183f1322985e72830949eb551a6572fe3', '8221a02264b4f5c83971b79bba68de096f49bc0e')},
    'kor/report/camp/jeongeup.html': {('b074c08ddd543bf86c6cbc94cc9b7fdd3543cfe1', 'ab1e3262356aed3a0bbaa1261b8ac4ce236bfbbb')},
    'kor/report/camp/gimhae.html': {('a67b4c1ecfa99c0a0b7b17979b3b336d8576997e', '05cd885ece332aeda44d7e62315c74f2b3c140b3')},
    'kor/report/camp/okcheon.html': {('43d0b034d21dde3630a12721d5fc782cc34e95cb', '4033840ca91635899ff111630d1a2e1ca0a29385')},
    'kor/report/camp/chilgok.html': {('6e42d405ae217e2606132c8d585cf70c1e1b77d5', 'ae6804356d90cb05659a0d0bb33a879de421843f')},
    'kor/report/camp/namyangju.html': {('a3b767ef1d7604a096514c6ec36ea6adf66fe4dd', 'd13b0802c28b8ef2ae58fde3e73f1440936ea695')},
    'kor/report/camp/naju.html': {('e0e8d669d228fb410291e2a16dc59a8217cd3ee4', '5d0bbd9034e8ec5e23a23f4bcded152e206e75af')},
}
for _path, _blob_pairs in APPROVED_AD_PLACEMENT_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).update(_blob_pairs)

for _path, _blob_pair in APPROVED_RPM_OPTIMIZATION_20261113_TRANSITIONS.items():
    APPROVED_PROTECTED_WINNER_TRANSITIONS.setdefault(_path, set()).add(_blob_pair)

APPROVED_MONETIZATION_TRANSITIONS = {
    "scripts/collect_adsense_snapshot.py": {
        ("94f34228ed8b10213085b3de19bbab14e4fee0de", "83595861b3ea484b7fd9ad0c7fb11515f6516692"),
        ("83595861b3ea484b7fd9ad0c7fb11515f6516692", "2f4890e73ae705c5347b3755c5fb4ef47ca23e2b"),
        ("2f4890e73ae705c5347b3755c5fb4ef47ca23e2b", "7e462d5e1ccedfba022594d98cabf4aa3697ca01"),
    },
}
APPROVED_JP_TRAVEL_CANARY_DELETIONS = {
    "jp/report/travel/bangladesh-lalmonirhat.html",
    "jp/report/travel/bangladesh-satkhira.html",
    "jp/report/travel/bangladesh-sirajganj.html",
    "jp/report/travel/barbados-bathsheba.html",
    "jp/report/travel/barbados-bridgetown.html",
    "jp/report/travel/botswana-ramotshwa.html",
    "jp/report/travel/brazil-curitiba.html",
    "jp/report/travel/brazil-rio.html",
    "jp/report/travel/canada-london.html",
    "jp/report/travel/chile-san-pedro-atacama.html",
    "jp/report/travel/colombia-santa-marta.html",
    "jp/report/travel/costa-rica-san-jose.html",
    "jp/report/travel/croatia-dubrovnik.html",
    "jp/report/travel/dominican-montecristi.html",
    "jp/report/travel/dominican-puntacana.html",
    "jp/report/travel/finland-helsinki.html",
    "jp/report/travel/greece-astypalaia.html",
    "jp/report/travel/greece-corfu.html",
    "jp/report/travel/greece-lefkada.html",
    "jp/report/travel/greece-mytilene.html",
    "jp/report/travel/india-ahmedabad.html",
    "jp/report/travel/india-delhi.html",
    "jp/report/travel/indonesia-ambon.html",
    "jp/report/travel/indonesia-medan.html",
    "jp/report/travel/indonesia-palembang.html",
    "jp/report/travel/ireland-cork.html",
    "jp/report/travel/ireland-waterford.html",
    "jp/report/travel/kenya-nairobi.html",
    "jp/report/travel/laos-luangprabang.html",
    "jp/report/travel/laos-pakse.html",
    "jp/report/travel/malaysia-kota-kinabalu.html",
    "jp/report/travel/maldives-male.html",
    "jp/report/travel/panama-city.html",
    "jp/report/travel/papua-new-guinea-port-moresby.html",
    "jp/report/travel/philippines-gensan.html",
    "jp/report/travel/philippines-iloilo.html",
    "jp/report/travel/portugal-aguassantas.html",
    "jp/report/travel/somalia-bosaso.html",
    "jp/report/travel/south-africa-cape-town.html",
    "jp/report/travel/south-africa-mossel-bay.html",
    "jp/report/travel/south-africa-paradise.html",
    "jp/report/travel/taiwan-taipei.html",
    "jp/report/travel/thailand-phuket.html",
    "jp/report/travel/thailand-ratchaburi.html",
    "jp/report/travel/thailand-tak.html",
    "jp/report/travel/thailand-udonthani.html",
    "jp/report/travel/uae-dubai.html",
    "jp/report/travel/uk-edinburgh.html",
    "jp/report/travel/uk-sheffield.html",
    "jp/report/travel/belgium-arden.html",
    "jp/report/travel/belgium-namur.html",
    "jp/report/travel/belgium-sint-truiden.html",
    "jp/report/travel/czech-svitavy.html",
    "jp/report/travel/czech-zlin.html",
    "jp/report/travel/finland-espoo.html",
    "jp/report/travel/finland-tampere.html",
    "jp/report/travel/france-angers.html",
    "jp/report/travel/france-angouleme.html",
    "jp/report/travel/france-annecy.html",
    "jp/report/travel/france-antibes.html",
    "jp/report/travel/france-argenteuil.html",
    "jp/report/travel/france-avignon.html",
    "jp/report/travel/france-bayonne.html",
    "jp/report/travel/france-bordeaux.html",
    "jp/report/travel/france-bourges.html",
    "jp/report/travel/france-brest.html",
    "jp/report/travel/france-calais.html",
    "jp/report/travel/france-charleville-mezieres.html",
    "jp/report/travel/france-clermont-ferrand.html",
    "jp/report/travel/france-dijon.html",
    "jp/report/travel/france-evianlesbains.html",
    "jp/report/travel/france-lehavre.html",
    "jp/report/travel/france-limoges.html",
    "jp/report/travel/france-lyon.html",
    "jp/report/travel/france-marseille.html",
    "jp/report/travel/france-menton.html",
    "jp/report/travel/france-mont-saint-michel.html",
    "jp/report/travel/france-montpellier.html",
    "jp/report/travel/france-montreuil.html",
    "jp/report/travel/france-mulhouse.html",
    "jp/report/travel/france-nantes.html",
    "jp/report/travel/france-nimes.html",
    "jp/report/travel/france-niort.html",
    "jp/report/travel/france-orleans.html",
    "jp/report/travel/france-paris.html",
    "jp/report/travel/france-perpignan.html",
    "jp/report/travel/france-poitiers.html",
    "jp/report/travel/france-rennes.html",
    "jp/report/travel/france-rouen.html",
    "jp/report/travel/france-saint-etienne.html",
    "jp/report/travel/france-sete.html",
    "jp/report/travel/france-strasbourg.html",
    "jp/report/travel/france-toulon.html",
    "jp/report/travel/france-toulouse.html",
    "jp/report/travel/france-valenciennes.html",
    "jp/report/travel/france-versailles.html",
    "jp/report/travel/italy-perugia.html",
    "jp/report/travel/norway-drobak.html",
    "jp/report/travel/poland-poznan.html",
}
ARABIC_RETIREMENT_OVERRIDE_PATH = "data/locale-retirement-overrides.json"
APPROVED_ARABIC_RETIREMENT_URLS = frozenset({
    "/ae/util/",
    "/ae/util/dice3d/",
    "/ae/util/text-cleaner/",
    "/ae/util/text-shuffle-sort/",
})
ARABIC_RETIREMENT_EVIDENCE = {
    "period": "2026-09-05..2026-10-02",
    "views": 13,
    "users": 12,
    "engagementSeconds": 256,
    "totalAdRevenue": 0.015871,
}
RAW_MEASUREMENT_HISTORY_PREFIX = "data/performance/"
SEOUL = ZoneInfo("Asia/Seoul")
TRUSTED_BASE_JSON_PATHS = (
    "data/content-launch-queue.json",
    "data/external-content-opportunities.json",
    "data/content-launch-decisions.json",
    "data/published_keywords.json",
    "data/content-launch-counter.json",
    "data/content-launch-manifest.json",
    "data/content-launch-experiments.json",
    "data/experiments.json",
    "data/revenue-opportunities.json",
    "data/site-audit.json",
    "data/content-launch-experiment-approvals.json",
)
EXPERIMENT_APPROVAL_JSON_PATH = "data/content-launch-experiment-approvals.json"
C02_034_EXPERIMENT = {
    "taskId": "C01-20261011-032",
    "candidateId": "C01-20261011-032-IPHONEDATE",
    "url": "/kor/report/window/iphone-photos-date-taken.html",
    "canonicalUrl": "https://emfls.github.io/kor/report/window/iphone-photos-date-taken.html",
    "contentPath": "kor/report/window/iphone-photos-date-taken.html",
    "hubPath": "kor/report/window/index.html",
    "sitemapPath": "kor/report/window/sitemap.xml",
    "title": "아이폰 사진 촬영일, 윈도우에서 확인하는 방법",
    "primaryIntent": "윈도우에서 아이폰 사진의 촬영일을 확인하고 전송 문제를 진단",
    "experimentScope": "ONE_PAGE",
    "demandStatus": "VOLUME_UNKNOWN",
    "approvalId": "C02-20261011-034-IPHONE-001",
    "approvalStatus": "CT_SCOPED_EXPERIMENT_REVIEW_ONLY",
    "approvalBasis": "STANDING_AUTHORIZATION_NARROWED_TO_THIS_TASK",
    "approvalRefs": (
        "https://app.notion.com/p/3f6db4c0a9918175b79bcbe85fabfbdd",
        "https://app.notion.com/p/3f6db4c0a99181dc8227d7fde28b740a",
    ),
    "sourceReviewRef": "https://app.notion.com/p/3f6db4c0a991818ebc3cccfddb68a3c7",
    "officialSourceUrls": frozenset({
        "https://support.apple.com/ko-kr/120267",
        "https://support.apple.com/ko-kr/116944",
        "https://support.microsoft.com/en-us/windows/apps/photos/import-photos-and-videos-from-phone-to-pc",
        "https://learn.microsoft.com/en-us/windows/win32/properties/props-system-photo-datetaken",
        "https://cipa.jp/std/documents/e/DC-X010-2017.pdf",
    }),
}
TRUSTED_BASE_CSV_PATHS = ("data/keywords_master.csv",)
TRUSTED_LAUNCH_CODE_PATHS = {
    ".github/workflows/content-index-refresh.yml",
    ".github/workflows/indexnow-submit.yml",
    ".github/workflows/keyword-hunter.yml",
    ".github/workflows/seo-qa.yml",
    "scripts/content_launch_decisions.py",
    "scripts/content_launch_guard.py",
    "scripts/content_launch_policy.py",
    "scripts/content_url_planner.py",
    "scripts/daily_revenue_growth.py",
    "scripts/external_content_opportunity.py",
    "scripts/external_discovery_pipeline.py",
    "scripts/new_content_opportunity.py",
    "scripts/prepare_external_launch.py",
    "scripts/prepare_keyword_launch.py",
}
KEYWORD_CANDIDATE_PATHS = {
    "kor/util/yeoncagaesugyesangi/index.html": "연차개수계산기",
    "kor/util/ingeonbigyesangi/index.html": "인건비계산기",
    "kor/column/enkajunggocagumae/index.html": "엔카중고차구매",
}


def _read(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def _trusted_base_snapshot(root, base_ref):
    """Read launch authority only from an immutable commit that is an ancestor of HEAD."""
    root = Path(root)
    resolved = subprocess.run(
        ["git", "rev-parse", "--verify", f"{base_ref}^{{commit}}"],
        cwd=str(root), text=True, capture_output=True, check=True,
    ).stdout.strip()
    ancestor = subprocess.run(
        ["git", "merge-base", "--is-ancestor", resolved, "HEAD"],
        cwd=str(root), text=True, capture_output=True, check=False,
    )
    if ancestor.returncode != 0:
        raise ValueError("trusted base revision is not an ancestor of the checked head")

    snapshot = {"revision": resolved, "json": {}, "csv": {}}
    for relative in TRUSTED_BASE_JSON_PATHS:
        result = subprocess.run(
            ["git", "show", f"{resolved}:{relative}"],
            cwd=str(root), text=True, capture_output=True, check=False,
        )
        if result.returncode != 0:
            if relative == EXPERIMENT_APPROVAL_JSON_PATH:
                snapshot["json"][relative] = None
                continue
            raise subprocess.CalledProcessError(result.returncode, result.args, result.stdout, result.stderr)
        snapshot["json"][relative] = json.loads(result.stdout)
    for relative in TRUSTED_BASE_CSV_PATHS:
        raw = subprocess.run(
            ["git", "show", f"{resolved}:{relative}"],
            cwd=str(root), text=True, capture_output=True, check=True,
        ).stdout
        snapshot["csv"][relative] = list(csv.DictReader(io.StringIO(raw)))
    return snapshot


def _decision_map(document):
    return decisions_from_document(document)


def _normalized_launch_url(value, *, require_absolute=False):
    """Return a same-site route identity, rejecting URL spellings that map ambiguously."""
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text or text != value:
        return None
    try:
        parsed = urlsplit(text)
        if parsed.query or parsed.fragment:
            return None
        if parsed.scheme or parsed.netloc:
            if (
                parsed.scheme.casefold() != "https"
                or (parsed.hostname or "").casefold() != SITE_HOST
                or parsed.username is not None
                or parsed.password is not None
                or parsed.port not in (None, 443)
            ):
                return None
        elif require_absolute or text.startswith("//"):
            return None
        path = parsed.path or "/"
    except ValueError:
        return None
    if (
        not path.startswith("/")
        or re.search(r"%(?![0-9a-fA-F]{2})", path)
        or re.search(r"%(?:2f|5c|2e)", path, re.I)
    ):
        return None
    decoded = unicodedata.normalize("NFC", unquote(path))
    if "\\" in decoded or "\x00" in decoded or "//" in decoded:
        return None
    segments = decoded.split("/")
    if any(part in {".", ".."} for part in segments) or any(not part for part in segments[1:-1]):
        return None
    if decoded.endswith("/index.html"):
        decoded = decoded[:-len("index.html")]
    return decoded


def _content_path_for_url(value):
    identity = _normalized_launch_url(value)
    if identity is None:
        return None
    if identity.endswith("/"):
        return f"{identity.lstrip('/')}index.html"
    if identity.casefold().endswith(".html"):
        return identity.lstrip("/")
    return None


def _safe_content_path(value):
    if not isinstance(value, str) or not value or value.startswith("/") or "\\" in value:
        return None
    path = Path(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in value.split("/")):
        return None
    if not value.casefold().endswith(".html"):
        return None
    return value


class _CanonicalLinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag.casefold() != "link":
            return
        attrs = {str(key).casefold(): value for key, value in attrs}
        if "canonical" in str(attrs.get("rel") or "").casefold().split():
            self.hrefs.append(attrs.get("href"))


class _AnchorParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag.casefold() == "a":
            attrs = {str(key).casefold(): value for key, value in attrs}
            if attrs.get("href"):
                self.hrefs.append(attrs["href"])


class _PageTitleParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_title = False
        self.in_h1 = False
        self.title_parts = []
        self.h1_parts = []

    def handle_starttag(self, tag, attrs):
        if tag.casefold() == "title":
            self.in_title = True
        elif tag.casefold() == "h1":
            self.in_h1 = True

    def handle_endtag(self, tag):
        if tag.casefold() == "title":
            self.in_title = False
        elif tag.casefold() == "h1":
            self.in_h1 = False

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        if self.in_h1:
            self.h1_parts.append(data)

    @property
    def title(self):
        return " ".join("".join(self.title_parts).split())

    @property
    def h1(self):
        return " ".join("".join(self.h1_parts).split())


def _validated_c02_034_approval(snapshot):
    document = snapshot.get("json", {}).get(EXPERIMENT_APPROVAL_JSON_PATH)
    if not isinstance(document, dict) or document.get("schemaVersion") != 1:
        return None, "missing_or_invalid"
    rows = document.get("approvals")
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
        return None, "ambiguous_or_invalid"
    record = rows[0]
    expected = C02_034_EXPERIMENT
    for key in (
        "approvalId", "taskId", "candidateId", "url", "canonicalUrl", "contentPath",
        "hubPath", "sitemapPath", "title", "primaryIntent", "experimentScope",
        "demandStatus", "approvalStatus",
        "approvalBasis",
    ):
        if record.get(key) != expected[key]:
            return None, "identity_or_scope_mismatch"
    if record.get("approvalVersion") != 1 or record.get("revoked") is not False:
        return None, "version_or_revocation_invalid"
    if record.get("ymyl") not in (False, True) or type(record.get("ymyl")) is not bool:
        return None, "ymyl_flag_invalid"
    refs = record.get("approvalRefs")
    if (
        not isinstance(refs, list)
        or len(refs) != len(expected["approvalRefs"])
        or any(not isinstance(value, str) for value in refs)
    ):
        return None, "approval_refs_invalid"
    if set(refs) != set(expected["approvalRefs"]):
        return None, "approval_refs_invalid"
    try:
        valid_from = date.fromisoformat(record.get("validFrom"))
        valid_through = date.fromisoformat(record.get("validThrough"))
        today = datetime.now(SEOUL).date()
    except (TypeError, ValueError):
        return None, "approval_dates_invalid"
    if not (valid_from <= today <= valid_through) or (valid_through - valid_from).days > 7:
        return None, "approval_expired_or_stale"

    review = record.get("sourceReview")
    if not isinstance(review, dict) or not (
        review.get("status") == "REPORTED_REVIEWED_BY_C01"
        and review.get("reviewedByTask") == expected["taskId"]
        and review.get("recordRef") == expected["sourceReviewRef"]
    ):
        return None, "source_review_unavailable"
    try:
        reviewed_at = date.fromisoformat(review.get("reviewedAt"))
    except (TypeError, ValueError):
        return None, "source_review_date_invalid"
    if not (valid_from <= reviewed_at <= today):
        return None, "source_review_date_invalid"
    source_rows = review.get("sources")
    if not isinstance(source_rows, list) or len(source_rows) != len(expected["officialSourceUrls"]):
        return None, "official_sources_unavailable"
    if any(
        not isinstance(source, dict) or not isinstance(source.get("supports"), str)
        or not source["supports"].strip() or not isinstance(source.get("url"), str)
        for source in source_rows
    ) or {source.get("url") for source in source_rows} != set(expected["officialSourceUrls"]):
        return None, "official_sources_unavailable"
    if any(key in record for key in (
        "monthlySearchVolume", "estimatedMonthlyVolume", "demandConfidence", "opportunityScore",
    )):
        return None, "unsupported_demand_claim"
    return record, None


def _trusted_candidate_records(snapshot):
    documents = snapshot["json"]
    queue_doc = documents["data/content-launch-queue.json"]
    external_doc = documents["data/external-content-opportunities.json"]
    if not isinstance(queue_doc, dict) or not isinstance(queue_doc.get("queue"), list):
        raise ValueError("invalid trusted keyword launch queue")
    if not isinstance(external_doc, dict) or not isinstance(external_doc.get("candidates"), list):
        raise ValueError("invalid trusted external candidate source")
    master_rows = snapshot["csv"]["data/keywords_master.csv"]
    master_by_keyword = {}
    for row in master_rows:
        identity = normalize_keyword(row.get("keyword"))
        if identity:
            master_by_keyword.setdefault(identity, []).append(row)

    records = []
    ambiguous_ids = set()
    queue_by_keyword = {}
    for row in queue_doc["queue"]:
        if not isinstance(row, dict):
            continue
        keyword = str(row.get("keyword") or "").strip()
        identity = normalize_keyword(keyword)
        if identity:
            queue_by_keyword.setdefault(identity, []).append(row)
    for identity, queue_rows in queue_by_keyword.items():
        if len(queue_rows) != 1:
            ambiguous_ids.add(f"keyword:{queue_rows[0].get('keyword', '')}")
            continue
        queue_row = queue_rows[0]
        if queue_row.get("status") != "READY_TO_LAUNCH" or queue_row.get("review_status") != "PAGE_REVIEW_READY":
            continue
        matches = master_by_keyword.get(identity, [])
        if len(matches) != 1:
            if len(matches) > 1:
                ambiguous_ids.add(f"keyword:{queue_row.get('keyword', '')}")
            continue
        master = matches[0]
        keyword = str(master.get("keyword") or "").strip()
        if (
            str(master.get("action") or "NEW_PAGE") != "NEW_PAGE"
            or str(master.get("score_valid") or "").casefold() not in {"true", "1", "yes"}
            or str(master.get("status") or "").upper() in {"PUBLISHED", "REJECTED", "COOLDOWN", "EXPIRED"}
        ):
            continue
        category = str(master.get("category") or "")
        content_types = str(master.get("content_types") or "")
        intent = str(master.get("intent") or "")
        planned_url = plan_url(keyword, category, content_types, intent)
        queue_url = queue_row.get("suggested_url")
        if (
            normalize_keyword(queue_row.get("keyword")) != identity
            or (queue_row.get("category") and str(queue_row.get("category")) != category)
            or _normalized_launch_url(queue_url) != _normalized_launch_url(planned_url)
        ):
            ambiguous_ids.add(f"keyword:{keyword}")
            continue
        records.append({
            "candidateId": f"keyword:{keyword}",
            "keyword": keyword,
            "editorialKeys": [identity],
            "ymyl": requires_ymyl_review({
                "keyword": keyword, "category": category, "content_types": content_types,
            }),
            "url": planned_url,
            "urlIdentity": _normalized_launch_url(planned_url),
            "contentPath": _content_path_for_url(planned_url),
            "source": "keyword",
        })

    ready_ids = external_doc.get("readyToLaunch") or []
    if not isinstance(ready_ids, list):
        raise ValueError("invalid trusted external ready list")
    ready_counts = {}
    for value in ready_ids:
        if isinstance(value, str) and value.strip():
            ready_counts[value] = ready_counts.get(value, 0) + 1
    external_by_id = {}
    for candidate in external_doc["candidates"]:
        if not isinstance(candidate, dict):
            continue
        candidate_id = candidate.get("candidateId")
        if isinstance(candidate_id, str) and candidate_id.strip():
            external_by_id.setdefault(candidate_id, []).append(candidate)
    for candidate_id, candidates in external_by_id.items():
        if len(candidates) > 1 or (candidate_id in ready_counts and ready_counts[candidate_id] > 1):
            ambiguous_ids.add(candidate_id)
            continue
        if ready_counts.get(candidate_id) != 1:
            continue
        if candidate_id != candidate_id.strip():
            ambiguous_ids.add(candidate_id)
            continue
        candidate = candidates[0]
        if launch_readiness(candidate).get("status") != "READY_TO_LAUNCH":
            continue
        declared_ymyl = candidate.get("ymyl")
        if declared_ymyl is not None and type(declared_ymyl) is not bool:
            ambiguous_ids.add(candidate_id)
            continue
        url = candidate.get("url")
        content_path = _safe_content_path(candidate.get("contentPath"))
        if not url or not content_path or _content_path_for_url(url) != content_path:
            ambiguous_ids.add(candidate_id)
            continue
        identity_texts = [
            candidate.get("keyword"), candidate.get("idea"),
            (candidate.get("discovery") or {}).get("observedTopic"),
            (candidate.get("intent") or {}).get("primary"),
            (candidate.get("brief") or {}).get("primaryIntent"),
        ]
        keyword = str(candidate.get("keyword") or candidate_id)
        editorial_key = normalize_keyword(keyword)
        candidate_key = normalize_keyword(candidate_id)
        editorial_keys = list(dict.fromkeys(key for key in (editorial_key, candidate_key) if key))
        records.append({
            "candidateId": candidate_id,
            "keyword": keyword,
            "editorialKeys": editorial_keys,
            "approvalKey": editorial_key or candidate_key,
            "ymyl": declared_ymyl is True or any(
                requires_ymyl_review({"keyword": value}) for value in identity_texts if value
            ),
            "url": url,
            "urlIdentity": _normalized_launch_url(url),
            "contentPath": content_path,
            "source": "external",
        })

    expected = C02_034_EXPERIMENT
    experiment_approval, experiment_approval_issue = _validated_c02_034_approval(snapshot)
    if experiment_approval is not None:
        candidate_id = expected["candidateId"]
        intent_key = normalize_keyword(expected["primaryIntent"])
        candidate_key = normalize_keyword(candidate_id)
        records.append({
            "candidateId": candidate_id,
            "keyword": expected["primaryIntent"],
            "editorialKeys": list(dict.fromkeys(key for key in (intent_key, candidate_key) if key)),
            "approvalKey": None,
            "ymyl": experiment_approval["ymyl"] or requires_ymyl_review({"keyword": expected["primaryIntent"]}),
            "url": expected["url"],
            "urlIdentity": _normalized_launch_url(expected["url"]),
            "contentPath": expected["contentPath"],
            "title": expected["title"],
            "primaryIntent": expected["primaryIntent"],
            "approval": experiment_approval,
            "source": "controlled_experiment",
        })

    by_id = {}
    by_url = {}
    by_path = {}
    for record in records:
        by_id.setdefault(record["candidateId"], []).append(record)
        if record["urlIdentity"]:
            by_url.setdefault(record["urlIdentity"], []).append(record)
        if record["contentPath"]:
            by_path.setdefault(record["contentPath"], []).append(record)
    for identity, matches in by_id.items():
        if len(matches) > 1:
            ambiguous_ids.add(identity)
    ambiguous_urls = {identity for identity, matches in by_url.items() if len(matches) > 1}
    ambiguous_paths = {identity for identity, matches in by_path.items() if len(matches) > 1}
    return {
        "byId": by_id,
        "byUrl": by_url,
        "byPath": by_path,
        "ambiguousIds": ambiguous_ids,
        "ambiguousUrls": ambiguous_urls,
        "ambiguousPaths": ambiguous_paths,
        "experimentApprovalIssue": experiment_approval_issue,
    }


def _base_published_identities(snapshot):
    documents = snapshot["json"]
    published_keywords = documents["data/published_keywords.json"]
    if not isinstance(published_keywords, list):
        raise ValueError("invalid published keywords registry")
    published_keywords_set = set()
    published_urls = set()
    for row in published_keywords:
        if not isinstance(row, dict):
            continue
        identity = normalize_keyword(row.get("keyword"))
        url_identity = _normalized_launch_url(row.get("url"))
        if identity:
            published_keywords_set.add(identity)
        if url_identity:
            published_urls.add(url_identity)
    manifest = documents["data/content-launch-manifest.json"]
    if not isinstance(manifest, dict):
        raise ValueError("invalid published content launch manifest")
    published_external_ids = set()
    preserved_manifests = manifest.get("preservedManifestRecords", [])
    if not isinstance(preserved_manifests, list) or any(not isinstance(row, dict) for row in preserved_manifests):
        raise ValueError("invalid preserved publication manifest records")
    _, manifest_keywords = published_manifest_dedupe_keys(manifest)
    is_final_manifest = str(manifest.get("status") or "").upper() in {"PUBLISHED", "LAUNCHED"}
    manifest_url_values = manifest.get("urls") or []
    if is_final_manifest and not isinstance(manifest_url_values, (list, tuple)):
        raise ValueError("invalid published manifest URLs")
    manifest_urls = set()
    for value in manifest_url_values:
        url_identity = _normalized_launch_url(value)
        if url_identity is None:
            if is_final_manifest:
                raise ValueError("invalid published manifest URL")
            continue
        manifest_urls.add(url_identity)
    for previous in preserved_manifests:
        previous_urls = previous.get("urls") or []
        previous_ids = previous.get("candidateIds") or []
        previous_paths = previous.get("contentPaths") or []
        if not all(isinstance(values, list) for values in (previous_urls, previous_ids, previous_paths)):
            raise ValueError("invalid preserved publication manifest identities")
        for value in previous_urls:
            identity = _normalized_launch_url(value)
            if identity is None:
                raise ValueError("invalid preserved publication manifest URL")
            manifest_urls.add(identity)
        for value in previous_ids:
            if not isinstance(value, str) or not value.strip():
                raise ValueError("invalid preserved publication candidate ID")
            keyword = keyword_from_candidate_id(value)
            if keyword:
                published_keywords_set.add(keyword)
            else:
                published_external_ids.add(value)
    published_urls.update(manifest_urls)
    published_keywords_set.update(manifest_keywords)
    published_external_ids.update({
        str(value) for value in (manifest.get("candidateIds") or [])
        if str(manifest.get("status") or "").upper() in {"PUBLISHED", "LAUNCHED"}
        and isinstance(value, str) and value.strip() and not keyword_from_candidate_id(value)
    })
    experiment_doc = documents["data/content-launch-experiments.json"]
    if not isinstance(experiment_doc, dict):
        raise ValueError("invalid content launch experiments")
    rows = experiment_doc.get("experiments", [])
    if not isinstance(rows, list):
        raise ValueError("invalid content launch experiments")
    for row in rows or []:
        if isinstance(row, dict) and row.get("candidateId"):
            published_external_ids.add(str(row["candidateId"]))
        if isinstance(row, dict):
            identity = _normalized_launch_url(row.get("url"))
            if identity:
                published_urls.add(identity)
    return published_keywords_set, published_urls, published_external_ids


def _published_count_for_day(snapshot, day):
    documents = snapshot["json"]
    counter = documents["data/content-launch-counter.json"]
    if not isinstance(counter, dict):
        raise ValueError("invalid publication counter")
    counts = []
    counter_day = publication_day(counter.get("date"))
    if counter_day is None:
        return DAILY_PUBLICATION_LIMIT
    if counter_day == day:
        count = counter.get("launchedCount")
        if type(count) is int and count >= 0:
            counts.append(count)
        else:
            counts.append(DAILY_PUBLICATION_LIMIT)
    manifest = documents["data/content-launch-manifest.json"]
    if not isinstance(manifest, dict):
        raise ValueError("invalid published content launch manifest")
    if isinstance(manifest, dict) and str(manifest.get("status") or "").upper() in {"PUBLISHED", "LAUNCHED"}:
        if publication_day(manifest.get("runAt") or manifest.get("publicationAccountingDate")) == day:
            counts.append(max(
                len(manifest.get("candidateIds") or []),
                len(manifest.get("urls") or []),
                len(manifest.get("contentPaths") or []),
                int(manifest.get("publishedToday") or 0),
            ))
    if not isinstance(manifest, dict):
        raise ValueError("invalid published content launch manifest")
    history = manifest.get("preservedManifestRecords", [])
    if not isinstance(history, list) or any(not isinstance(row, dict) for row in history):
        raise ValueError("invalid preserved publication manifest records")
    historical_counts = []
    for row in history:
        if publication_day(row.get("runAt") or row.get("publicationAccountingDate")) == day:
            historical_counts.append(max(
                len(row.get("candidateIds") or []),
                len(row.get("urls") or []),
                len(row.get("contentPaths") or []),
                int(row.get("publishedToday") or 0),
            ))
    if historical_counts:
        counts.append(sum(historical_counts))
    experiment_doc = documents["data/content-launch-experiments.json"]
    if not isinstance(experiment_doc, dict) or not isinstance(experiment_doc.get("experiments", []), list):
        raise ValueError("invalid content launch experiments")
    rows = experiment_doc.get("experiments", [])
    counts.append(sum(
        1 for row in rows or []
        if isinstance(row, dict)
        and publication_day(row.get("publishedAt") or row.get("publishedOn")) == day
    ))
    published_keywords = documents["data/published_keywords.json"]
    if not isinstance(published_keywords, list):
        raise ValueError("invalid published keywords registry")
    counts.append(sum(
        1 for row in published_keywords if isinstance(row, dict)
        and publication_day(row.get("at") or row.get("publishedAt")) == day
    ))
    return max(counts, default=0)


def _validate_candidate_bindings(root, manifest, added_html, snapshot, errors, ops_dir=None):
    root = Path(root)
    state_root = Path(ops_dir or root)
    if not isinstance(snapshot, dict):
        errors.add("TRUSTED_BASE_REVISION_UNAVAILABLE")
        return
    try:
        sources = _trusted_candidate_records(snapshot)
        base_decisions = _decision_map(snapshot["json"]["data/content-launch-decisions.json"])
        head_decisions = _decision_map(_read(state_root / "data/content-launch-decisions.json", {}))
        published_keywords, published_urls, published_external_ids = _base_published_identities(snapshot)
    except (KeyError, TypeError, ValueError, OSError, csv.Error):
        errors.add("TRUSTED_BASE_REVISION_UNAVAILABLE")
        return
    if base_decisions != head_decisions:
        errors.add("EDITORIAL_DECISION_TAMPERING")
    urls = manifest.get("urls")
    paths = manifest.get("contentPaths")
    candidate_ids = manifest.get("candidateIds")
    if not all(isinstance(values, list) for values in (urls, paths, candidate_ids)):
        errors.add("CANDIDATE_IDENTITY_MISMATCH")
        return
    if not (len(urls) == len(paths) == len(candidate_ids) == len(added_html)):
        errors.add("CANDIDATE_IDENTITY_MISMATCH")
    if (
        len(set(value for value in urls if isinstance(value, str))) != len(urls)
        or len(set(value for value in paths if isinstance(value, str))) != len(paths)
        or len(set(value for value in candidate_ids if isinstance(value, str))) != len(candidate_ids)
    ):
        errors.add("CANDIDATE_IDENTITY_MISMATCH")
        if len(set(value for value in candidate_ids if isinstance(value, str))) != len(candidate_ids):
            errors.add("LAUNCH_CANDIDATE_IDS_REQUIRED")

    if not (
        isinstance(candidate_ids, list)
        and len(candidate_ids) == len(added_html)
        and isinstance(urls, list)
        and isinstance(paths, list)
        and len(urls) == len(paths) == len(candidate_ids)
    ):
        return

    if set(paths) != added_html:
        errors.add("CANDIDATE_IDENTITY_MISMATCH")
    today = datetime.now(SEOUL).date()
    daily_limit = manifest.get("dailyLimit", DAILY_PUBLICATION_LIMIT)
    if type(daily_limit) is not int or not 0 <= daily_limit <= DAILY_PUBLICATION_LIMIT:
        errors.add("PUBLICATION_LIMIT_EXCEEDED")
        daily_limit = DAILY_PUBLICATION_LIMIT
    if len(added_html) + _published_count_for_day(snapshot, today) > daily_limit:
        errors.add("PUBLICATION_LIMIT_EXCEEDED")

    experiment = C02_034_EXPERIMENT
    if experiment["candidateId"] in candidate_ids:
        if not (
            candidate_ids == [experiment["candidateId"]]
            and urls == [experiment["url"]]
            and paths == [experiment["contentPath"]]
            and added_html == {experiment["contentPath"]}
            and manifest.get("taskId") == experiment["taskId"]
            and manifest.get("experimentScope") == experiment["experimentScope"]
            and manifest.get("demandStatus") == experiment["demandStatus"]
            and manifest.get("status") == "READY_FOR_REVIEW"
            and manifest.get("candidateIntents") == [experiment["primaryIntent"]]
            and manifest.get("candidateTitles") == [experiment["title"]]
            and manifest.get("hubPaths") == [experiment["hubPath"]]
            and manifest.get("sitemapPaths") == [experiment["sitemapPath"]]
        ):
            errors.add("CANDIDATE_IDENTITY_MISMATCH")
        if daily_limit != 1:
            errors.add("PUBLICATION_LIMIT_EXCEEDED")
        base_manifest = snapshot["json"].get("data/content-launch-manifest.json") or {}
        if not isinstance(base_manifest, dict):
            errors.add("PUBLISHED_MANIFEST_HISTORY_DROPPED")
        else:
            base_history = base_manifest.get("preservedManifestRecords", [])
            if not isinstance(base_history, list):
                errors.add("PUBLISHED_MANIFEST_HISTORY_DROPPED")
            else:
                required_history = list(base_history)
                if any(base_manifest.get(key) for key in ("candidateIds", "urls", "contentPaths")):
                    required_history.append(base_manifest)
                head_history = manifest.get("preservedManifestRecords", [])
                if head_history != required_history:
                    errors.add("PUBLISHED_MANIFEST_HISTORY_DROPPED")

    for candidate_id, url, content_path in zip(candidate_ids, urls, paths):
        if not isinstance(candidate_id, str) or not candidate_id.strip():
            errors.add("LAUNCH_CANDIDATE_IDS_REQUIRED")
            errors.add("CANDIDATE_IDENTITY_MISMATCH")
            continue
        matches = sources["byId"].get(candidate_id, [])
        if (
            candidate_id == experiment["candidateId"]
            and sources.get("experimentApprovalIssue") is not None
        ):
            errors.add("APPROVAL_EVIDENCE_UNAVAILABLE")
            if sources["experimentApprovalIssue"] == "ambiguous_or_invalid":
                errors.add("AMBIGUOUS_TRUSTED_CANDIDATE")
        if candidate_id in sources["ambiguousIds"] or len(matches) > 1:
            errors.add("AMBIGUOUS_TRUSTED_CANDIDATE")
            continue
        if len(matches) != 1:
            errors.add("TRUSTED_CANDIDATE_NOT_FOUND")
            continue
        source = matches[0]
        url_identity = _normalized_launch_url(url)
        manifest_path = _safe_content_path(content_path)
        if (
            url_identity is None
            or manifest_path is None
            or source["urlIdentity"] is None
            or source["urlIdentity"] != url_identity
            or source["contentPath"] != manifest_path
            or _content_path_for_url(url) != manifest_path
            or url_identity in sources["ambiguousUrls"]
            or manifest_path in sources["ambiguousPaths"]
        ):
            errors.add("CANDIDATE_IDENTITY_MISMATCH")
            continue
        if source["source"] == "keyword":
            identity = normalize_keyword(source["keyword"])
            if identity in published_keywords:
                errors.add("CANDIDATE_ALREADY_PUBLISHED")
        elif candidate_id in published_external_ids:
            errors.add("CANDIDATE_ALREADY_PUBLISHED")
        if url_identity in published_urls:
            errors.add("CANDIDATE_ALREADY_PUBLISHED")

        editorial_keys = source["editorialKeys"]
        if source["source"] == "controlled_experiment" and source["ymyl"]:
            errors.add("YMYL_REVIEW_REQUIRED")
        for identity in editorial_keys:
            base_decision = base_decisions.get(identity)
            if base_decision in {"HOLD", "NO_NEW_PAGE", "UPDATE_EXISTING"}:
                errors.add("EDITORIAL_DECISION_BLOCKED")
            if source["ymyl"] and identity == source.get("approvalKey", identity) and base_decision != "APPROVE":
                errors.add("YMYL_REVIEW_REQUIRED")

        page_path = root / manifest_path
        try:
            page_path.resolve().relative_to(root.resolve())
            if page_path.is_symlink():
                raise ValueError("content path must not be a symlink")
            html = page_path.read_text(encoding="utf-8")
            parser = _CanonicalLinkParser()
            parser.feed(html)
            title_parser = _PageTitleParser()
            title_parser.feed(html)
        except (OSError, ValueError):
            errors.add("CANDIDATE_IDENTITY_MISMATCH")
            continue
        if (
            len(parser.hrefs) != 1
            or _normalized_launch_url(parser.hrefs[0], require_absolute=True) != url_identity
        ):
            errors.add("CANONICAL_MISMATCH")
        if source["source"] == "controlled_experiment" and (
            title_parser.title != source["title"] or title_parser.h1 != source["title"]
        ):
            errors.add("CANDIDATE_IDENTITY_MISMATCH")


def _url_to_path(url):
    return str(url or "").split("?", 1)[0].lstrip("/")


def _url_to_content_path(url):
    clean = str(url or "").split("?", 1)[0]
    path = clean.lstrip("/")
    return f"{path}index.html" if clean.endswith("/") else path


def _approved_arabic_retirement_paths(root):
    record = _read(Path(root) / ARABIC_RETIREMENT_OVERRIDE_PATH, {})
    if not isinstance(record, dict):
        return set()
    urls = record.get("urls")
    evidence = record.get("evidence")
    if not isinstance(evidence, dict):
        return set()
    ga4 = evidence.get("ga4")
    gsc = evidence.get("gsc")
    if not isinstance(ga4, dict) or not isinstance(gsc, dict):
        return set()
    if not (
        record.get("schemaVersion") == 1
        and record.get("locale") == "ae"
        and record.get("decision") == "RETIRED"
        and record.get("status") == "USER_APPROVED_LOCALE_RETIREMENT_OVERRIDE"
        and record.get("approved") is True
        and record.get("preserveRawMeasurements") is True
        and bool(str(record.get("reason") or "").strip())
        and isinstance(urls, list)
        and len(urls) == len(APPROVED_ARABIC_RETIREMENT_URLS)
        and all(isinstance(url, str) for url in urls)
        and set(urls) == APPROVED_ARABIC_RETIREMENT_URLS
        and all(url.startswith("/ae/") for url in urls)
        and ga4 == ARABIC_RETIREMENT_EVIDENCE
        and gsc == {"status": "NO_ROW"}
    ):
        return set()
    return {_url_to_content_path(url) for url in urls}


def _changed_tuple(item):
    if not isinstance(item, tuple):
        return "M", item, None, None
    if len(item) == 2:
        return item[0], item[1], None, None
    if len(item) == 4:
        return item
    raise ValueError("changed path entries must contain status/path or status/path/blob transition")


def validate_launch(root, manifest, changed_paths, trusted_base=None, ops_dir=None):
    root = Path(root)
    state_root = Path(ops_dir or root)
    changed = [_changed_tuple(row) for row in changed_paths]
    errors = set()
    changed_names = {row[1] for row in changed}
    approved_arabic_retirement_paths = _approved_arabic_retirement_paths(state_root)
    added_html = {
        row[1] for row in changed
        if row[0] == "A" and row[1].endswith(".html")
        and (row[2], row[3]) != APPROVED_NAVIGATION_HUB_ADDITIONS.get(row[1])
    }
    expected_html = set(manifest.get("contentPaths") or [_url_to_path(url) for url in manifest.get("urls") or []])
    # A manifest can change for launch bookkeeping without adding content.
    # Only a newly added HTML file starts content-launch validation; when HTML
    # is added, it must still match the manifest exactly.
    launch_changed = bool(added_html)
    if launch_changed and EXPERIMENT_APPROVAL_JSON_PATH in changed_names:
        errors.add("APPROVAL_EVIDENCE_CHANGED_WITH_CONTENT")
    if launch_changed and added_html != expected_html:
        errors.add("MANIFEST_DIFF_MISMATCH")
    if launch_changed and changed_names & TRUSTED_LAUNCH_CODE_PATHS:
        errors.add("LAUNCH_GUARD_CHANGED_WITH_CONTENT")
    if launch_changed and trusted_base is None:
        repository_check = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=str(root), text=True, capture_output=True, check=False,
        )
        if repository_check.returncode == 0:
            errors.add("TRUSTED_BASE_REVISION_REQUIRED")
    if launch_changed:
        if trusted_base is not None:
            _validate_candidate_bindings(root, manifest, added_html, trusted_base, errors, ops_dir=state_root)
        else:
            candidate_ids = manifest.get("candidateIds")
            if (
                not isinstance(candidate_ids, list)
                or len(candidate_ids) != len(added_html)
                or any(not isinstance(value, str) or not value.strip() for value in candidate_ids)
                or len(set(candidate_ids)) != len(candidate_ids)
            ):
                errors.add("LAUNCH_CANDIDATE_IDS_REQUIRED")
            candidate_keywords = set()
            if isinstance(candidate_ids, list):
                for value in candidate_ids:
                    keyword = keyword_from_candidate_id(value)
                    if keyword:
                        candidate_keywords.add(keyword)
                    else:
                        errors.add("LAUNCH_KEYWORD_ID_REQUIRED")
            candidate_keywords.update(
                KEYWORD_CANDIDATE_PATHS[path]
                for path in added_html
                if path in KEYWORD_CANDIDATE_PATHS
            )
            try:
                editorial_decisions = load_decisions(state_root / "data/content-launch-decisions.json")
            except (OSError, TypeError, ValueError):
                editorial_decisions = {}
                errors.add("EDITORIAL_DECISIONS_UNAVAILABLE")
            for keyword in candidate_keywords:
                decision = editorial_decisions.get(keyword)
                if decision in {"HOLD", "NO_NEW_PAGE", "UPDATE_EXISTING"}:
                    errors.add("EDITORIAL_DECISION_BLOCKED")
                if requires_ymyl_review({"keyword": keyword}) and decision != "APPROVE":
                    errors.add("YMYL_REVIEW_REQUIRED")
    # Only exact, evidenced Arabic retirement exceptions and this exact JP
    # Travel canary are authorized; keep every other deletion and rename closed.
    unauthorized_deletion = any(
        row[0].startswith(("D", "R"))
        and not (
            row[0] == "D"
            and (row[1] in approved_arabic_retirement_paths or row[1] in APPROVED_JP_TRAVEL_CANARY_DELETIONS)
        )
        for row in changed
    )
    if manifest.get("deletions") or unauthorized_deletion:
        errors.add("DELETION_NOT_ALLOWED")
    if any(
        status.startswith("D") and path.startswith(RAW_MEASUREMENT_HISTORY_PREFIX)
        for status, path, _, _ in changed
    ):
        errors.add("RAW_MEASUREMENT_HISTORY_DELETION_NOT_ALLOWED")

    base_documents = trusted_base.get("json", {}) if trusted_base else {}
    ctr = base_documents.get("data/experiments.json") or _read(state_root / "data/experiments.json", {"experiments": []})
    protected_experiments = {_url_to_content_path(row.get("url")) for row in ctr.get("experiments") or [] if row.get("status") == "OBSERVING"}
    revenue = base_documents.get("data/revenue-opportunities.json") or _read(state_root / "data/revenue-opportunities.json", {})
    protected_winners = {_url_to_content_path(row.get("url")) for row in revenue.get("protectedWinners") or []}
    if changed_names & protected_experiments:
        errors.add("PROTECTED_EXPERIMENT_CHANGED")
    for path in changed_names & protected_winners:
        path_changes = [row for row in changed if row[1] == path]
        approved = APPROVED_PROTECTED_WINNER_TRANSITIONS.get(path, set())
        if (
            len(path_changes) == 1
            and path_changes[0][0] == "D"
            and path in approved_arabic_retirement_paths
        ):
            continue
        if (
            len(path_changes) != 1
            or path_changes[0][0] != "M"
            or (path_changes[0][2], path_changes[0][3]) not in approved
        ):
            errors.add("PROTECTED_WINNER_CHANGED")
    if any(
        path not in MEASUREMENT_WORKFLOW_ALLOWLIST
        and not (status == "A" and path in APPROVED_MONETIZATION_ADDITIONS)
        and not (
            status == "M"
            and path in APPROVED_MONETIZATION_TRANSITIONS
            and (before_blob, after_blob) in APPROVED_MONETIZATION_TRANSITIONS[path]
        )
        and not (
            status in {"A", "M"}
            and (status == "A") == (before_blob is None)
            and (before_blob, after_blob) == APPROVED_RPM_OPTIMIZATION_20261113_TRANSITIONS.get(path)
        )
        and (
            path in APPROVED_MONETIZATION_ADDITIONS
            or re.search(r"(^|/)(ads?|adsense|ga4|analytics)([._/-]|$)", path, re.I)
        )
        for status, path, before_blob, after_blob in changed
    ):
        errors.add("MONETIZATION_OR_ANALYTICS_CHANGED")

    if not launch_changed:
        return sorted(errors)

    audit = base_documents.get("data/site-audit.json") or _read(state_root / "data/site-audit.json", {"pages": []})
    manifest_urls = set(manifest.get("urls") or [])
    existing_rows = [
        row
        for row in audit.get("pages") or []
        if row.get("path") not in expected_html and row.get("url") not in manifest_urls
    ]
    existing_titles = {row.get("title") for row in existing_rows if row.get("title")}
    existing_h1 = {row.get("h1") for row in existing_rows if row.get("h1")}
    titles, headings, canonicals = set(), set(), set()
    sitemap_text = "\n".join((root / path).read_text(encoding="utf-8") for path in manifest.get("sitemapPaths") or [] if (root / path).exists())
    hub_text = "\n".join((root / path).read_text(encoding="utf-8") for path in manifest.get("hubPaths") or [] if (root / path).exists())
    hub_parser = _AnchorParser()
    hub_parser.feed(hub_text)
    hub_url_identities = {
        identity for href in hub_parser.hrefs
        if (identity := _normalized_launch_url(href)) is not None
    }
    for url, relative in zip(manifest.get("urls") or [], manifest.get("contentPaths") or []):
        path = root / relative
        if not path.exists():
            errors.add("CONTENT_FILE_MISSING")
            continue
        html = path.read_text(encoding="utf-8")
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
        title = re.sub(r"<[^>]+>", "", title_match.group(1)).strip() if title_match else None
        h1 = re.sub(r"<[^>]+>", "", h1_match.group(1)).strip() if h1_match else None
        canonical_parser = _CanonicalLinkParser()
        canonical_parser.feed(html)
        canonical = canonical_parser.hrefs[0] if len(canonical_parser.hrefs) == 1 else None
        expected_identity = _normalized_launch_url(url)
        expected_canonical = f"https://{SITE_HOST}{expected_identity}" if expected_identity else None
        if not title or title in titles or title in existing_titles:
            errors.add("TITLE_MISSING_OR_DUPLICATE")
        if not h1 or h1 in headings or h1 in existing_h1:
            errors.add("H1_MISSING_OR_DUPLICATE")
        canonical_identity = _normalized_launch_url(canonical, require_absolute=True) if canonical else None
        if canonical_identity != expected_identity or canonical_identity in canonicals:
            errors.add("CANONICAL_MISMATCH")
        titles.add(title); headings.add(h1); canonicals.add(canonical_identity)
        if not re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I):
            errors.add("VIEWPORT_MISSING")
        if 'application/ld+json' not in html:
            errors.add("JSON_LD_MISSING")
        if expected_identity and expected_identity not in sitemap_text:
            errors.add("SITEMAP_ENTRY_MISSING")
        if expected_identity and expected_identity not in hub_url_identities:
            errors.add("HUB_LINK_MISSING")
    return sorted(errors)


def _git_changes(root, base_ref):
    result = subprocess.run(["git", "diff", "--name-status", base_ref, "HEAD"], cwd=str(root), text=True, capture_output=True, check=True)
    rows = []
    for line in result.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            status, path = parts[0], parts[-1]
            if status == "A" and (
                path in APPROVED_NAVIGATION_HUB_ADDITIONS
                or path in APPROVED_RPM_OPTIMIZATION_20261113_TRANSITIONS
            ):
                after = subprocess.run(
                    ["git", "rev-parse", f"HEAD:{path}"],
                    cwd=str(root), text=True, capture_output=True, check=True,
                ).stdout.strip()
                rows.append((status, path, None, after))
            elif status == "M" and (
                path in APPROVED_PROTECTED_WINNER_TRANSITIONS
                or path in APPROVED_MONETIZATION_TRANSITIONS
            ):
                before = subprocess.run(
                    ["git", "rev-parse", f"{base_ref}:{path}"],
                    cwd=str(root), text=True, capture_output=True, check=True,
                ).stdout.strip()
                after = subprocess.run(
                    ["git", "rev-parse", f"HEAD:{path}"],
                    cwd=str(root), text=True, capture_output=True, check=True,
                ).stdout.strip()
                rows.append((status, path, before, after))
            else:
                rows.append((status, path))
    return rows


def _validated_change_base(root, base_ref):
    """Resolve the change-set base and require it to be an ancestor of HEAD."""
    resolved = subprocess.run(
        ["git", "rev-parse", "--verify", f"{base_ref}^{{commit}}"],
        cwd=str(root), text=True, capture_output=True, check=True,
    ).stdout.strip()
    ancestor = subprocess.run(
        ["git", "merge-base", "--is-ancestor", resolved, "HEAD"],
        cwd=str(root), text=True, capture_output=True, check=False,
    )
    if ancestor.returncode != 0:
        raise ValueError("change base revision is not an ancestor of the checked head")
    return resolved


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--ops-dir", type=Path, default=Path(os.environ["EMFLS_OPS_DIR"]) if os.environ.get("EMFLS_OPS_DIR") else None)
    parser.add_argument("--manifest", type=Path, default=Path(os.environ["EMFLS_OPS_DIR"]) / "data/content-launch-manifest.json" if os.environ.get("EMFLS_OPS_DIR") else Path("data/content-launch-manifest.json"))
    parser.add_argument("--base-ref", default="HEAD")
    parser.add_argument("--change-base-ref", help="Commit used to calculate changed paths; defaults to --base-ref.")
    args = parser.parse_args()
    manifest = _read(args.root / args.manifest, {})
    try:
        trusted_base = _trusted_base_snapshot(args.root, args.base_ref)
    except (OSError, TypeError, ValueError, KeyError, subprocess.CalledProcessError, csv.Error):
        errors = ["TRUSTED_BASE_REVISION_UNAVAILABLE"]
    else:
        try:
            change_ref = _validated_change_base(args.root, args.change_base_ref or args.base_ref)
            changed_paths = _git_changes(args.root, change_ref)
            errors = validate_launch(args.root, manifest, changed_paths, trusted_base=trusted_base, ops_dir=args.ops_dir)
        except (OSError, TypeError, ValueError, KeyError, subprocess.CalledProcessError, csv.Error):
            errors = ["CHANGE_BASE_REVISION_UNAVAILABLE"]
    print(json.dumps({"status": "FAIL" if errors else "PASS", "errors": errors}))
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
