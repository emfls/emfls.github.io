# Existing camping-page reading paths — 2026-11-05

The owner delegated immediate improvements and deployment for additional useful reading on existing revenue pages. Scope: Gyeonggi BEST, Pyeongtaek, Cheorwon and Jeongseon only. Replace their compact planning navigation with three intent-based destinations: compare another relevant region, check public winter operations, or make a camping packing checklist.

This approval PR records only exact before/after Git blobs. The separately merged content PR will contain the four HTML files and their directly affected test expectations. No article, category hub, queue item, scheduled job, publication count, analytics event, ad unit, metadata, factual claim or general guard exception is added. Existing historical approvals and all guard logic remain active.

## Review and validation

- A one-off full-diff check proves the four HTML files change only the planning nav and its scoped CSS. All scripts (including JSON-LD), title/H1/meta/canonical, ad markup and the remaining factual HTML are identical to base main 8f72d04dafbc4d03bb3080ede77cf4b6354ee30b.
- The focused navigation regression requires one labeled nav with three distinct existing destinations, including the working packing tool, and rejects self-links/duplicate IDs. The former free-camping/region link expectations are updated to the intentionally selected destinations rather than retaining unrelated links.
- Parent browser review: all four pages at 390px and 1458px have no document/nav overflow, touch cards at least85px high, legible mobile content and separate ads below. Clicking the packing link reaches the working conditional tool. Screenshot: /tmp/revenue-reader-mobile.png (local evidence, not published).
- Exact transition test RED before approval; positives and modified-input/modified-output/reversed/unrelated-WINNER negatives are required. The committed content must pass the existing pinned-ops Guard after this approval reaches trusted main.
- Current clean main baseline is rebuilt into /tmp from its exact Git archive; fixed operating baseline and ops source remain unchanged. Current main has745 existing critical issues and420 warnings. Actual current-main SEO delta, Pages and public bytes must be verified before completion; no revenue uplift is claimed.

## Exact transitions

| Path | Before | After |
| --- | --- | --- |
| kor/report/camp/gyeonggi-best.html | 4ba21616b89fd1bef0a23b44ffebc355bff5b55c | 2d0a4ff260f49571c41bf6f1ef550fe5c6980749 |
| kor/report/camp/pyeongtaek.html | b631bae28b4017f5d5ace5932557869ff4d1d090 | 9e5a63ab577bd29a3b75c993e48062b574082f6b |
| kor/report/camp/cheorwon.html | c1aadf2a33f1865ada29aa277a351347ed18b18d | 09dca99bf5db9969f37b57cf2bc3dac15ec82e55 |
| kor/report/camp/jeongseon.html | e91280a85c6939d3be02808287773c4cab5cd495 | 102a6320e3f8f29c61fdd361d4502ce3385ee5b1 |

## Complete proposed HTML patch

```diff
diff --git a/kor/report/camp/cheorwon.html b/kor/report/camp/cheorwon.html
index c1aadf2a..09dca99b 100644
--- a/kor/report/camp/cheorwon.html
+++ b/kor/report/camp/cheorwon.html
@@ -308,7 +308,11 @@
             }
         }
     /* 홈 버튼 스타일 */.home-button-container {position: fixed;bottom: 20px;left: 50%;transform: translateX(-50%);z-index: 1000;}.home-button {display: inline-flex;align-items: center;justify-content: center;background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);color: white;text-decoration: none;padding: 12px 24px;border-radius: 50px;font-weight: 600;font-size: 16px;box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);transition: all 0.3s ease;border: none;cursor: pointer;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;}.home-button:hover {transform: translateY(-2px);box-shadow: 0 6px 25px rgba(102, 126, 234, 0.4);color: white;text-decoration: none;}.home-button:active {transform: translateY(0);}.home-icon {margin-right: 8px;font-size: 18px;}/* 모바일 대응 */@media (max-width: 768px) {.home-button-container {    bottom: 15px;}.home-button {    padding: 10px 20px;    font-size: 14px;}.home-icon {    font-size: 16px;}}</style>
-<style>ins.adsbygoogle,div[id^="aswift_"],iframe[id^="aswift_"]{max-width:100%!important;overflow:hidden!important}</style><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"철원 캠핑 2026","url":"https://emfls.github.io/kor/report/camp/cheorwon.html","dateModified":"2026-10-14","inLanguage":"ko-KR"}</script></head>
+<style>ins.adsbygoogle,div[id^="aswift_"],iframe[id^="aswift_"]{max-width:100%!important;overflow:hidden!important}</style><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"철원 캠핑 2026","url":"https://emfls.github.io/kor/report/camp/cheorwon.html","dateModified":"2026-10-14","inLanguage":"ko-KR"}</script>
+<style id="camp-next-reading-style">
+.camp-next-reading{margin:20px 0;padding:18px;border:1px solid #bacbd2;border-radius:12px;background:#f4f8fa;color:#172d3b;line-height:1.65}.camp-next-reading h2{font-size:1.15rem;margin:0 0 8px;color:#172d3b}.camp-next-reading p{margin:0 0 12px}.camp-next-reading ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}.camp-next-reading a{display:block;padding:14px;border:1px solid #bacbd2;border-radius:8px;background:#fff;color:#164c74;text-decoration:underline;text-underline-offset:3px}.camp-next-reading a:focus-visible{outline:3px solid #a65000;outline-offset:3px}.camp-next-reading strong,.camp-next-reading span{display:block}.camp-next-reading span{font-size:.9rem;color:#354b59;margin-top:5px}
+</style>
+</head>
 <body><!-- 홈 버튼 --><div class="home-button-container"><a href="index.html" class="home-button">    <span class="home-icon">🏠</span>    홈으로</a></div>
     <div class="container">
         <header>
@@ -328,7 +332,15 @@
                 <dt><strong>요금·허용 여부</strong></dt><dd>무료 주차나 관광지 입장이 무료 야영을 뜻하지 않습니다. 현장 금지 안내와 관리기관 공지를 따르세요.</dd>
                 <dt><strong>최종 재검토</strong></dt><dd>2026-10-14 · 철원군과 캠핑장 운영자의 최신 안내를 확인하세요.</dd>
             </dl>
-            <nav aria-label="강원 지역 캠핑 가이드"><a href="/kor/report/camp/gangwon-best.html">강원 추천</a> · <a href="/kor/report/camp/taebaek.html">태백</a> · <a href="/kor/report/camp/pyeongchang.html">평창</a></nav>
+            <nav class="camp-next-reading" aria-labelledby="camp-next-reading-title">
+<h2 id="camp-next-reading-title">다음으로 무엇을 확인할까요?</h2>
+<p>장소를 비교 중인지, 겨울 일정이나 준비물을 정할 차례인지에 따라 필요한 안내를 선택하세요.</p>
+<ul>
+<li><a href="/kor/report/camp/jeongseon.html"><strong>정선 캠핑 이용조건 비교 →</strong><span>도사곡과 관광지 주변의 야영 이용조건을 구분해 보세요.</span></a></li>
+<li><a href="/kor/report/camp/winter-public-campsites-2026.html"><strong>겨울 운영·휴장 먼저 확인 →</strong><span>공공 야영장 요금과 운영 확인 등급을 비교하세요. 잔여석은 예약처에서 확인해야 합니다.</span></a></li>
+<li><a href="/kor/util/camping-packing-checklist/"><strong>인원·계절별 준비물 만들기 →</strong><span>숙박일과 캠핑 방식에 맞춰 짐 목록을 만들고 인쇄할 수 있습니다.</span></a></li>
+</ul>
+</nav>
         </section>
 <!-- emfls-manual-ad: in-article -->
 <aside class="emfls-manual-ad" aria-label="광고" style="display:block;width:100%;max-width:100%;margin:32px auto;padding:8px 0;text-align:center;">
diff --git a/kor/report/camp/gyeonggi-best.html b/kor/report/camp/gyeonggi-best.html
index 4ba21616..2d0a4ff2 100644
--- a/kor/report/camp/gyeonggi-best.html
+++ b/kor/report/camp/gyeonggi-best.html
@@ -62,6 +62,10 @@
         footer a{color:#27ae60;}
         @media(max-width:600px){header h1{font-size:1.5rem;}.spots-grid{grid-template-columns:1fr;}}
     </style>
+
+<style id="camp-next-reading-style">
+.camp-next-reading{margin:20px 0;padding:18px;border:1px solid #bacbd2;border-radius:12px;background:#f4f8fa;color:#172d3b;line-height:1.65}.camp-next-reading h2{font-size:1.15rem;margin:0 0 8px;color:#172d3b}.camp-next-reading p{margin:0 0 12px}.camp-next-reading ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}.camp-next-reading a{display:block;padding:14px;border:1px solid #bacbd2;border-radius:8px;background:#fff;color:#164c74;text-decoration:underline;text-underline-offset:3px}.camp-next-reading a:focus-visible{outline:3px solid #a65000;outline-offset:3px}.camp-next-reading strong,.camp-next-reading span{display:block}.camp-next-reading span{font-size:.9rem;color:#354b59;margin-top:5px}
+</style>
 </head>
 <body>
 <div class="container">
@@ -82,7 +86,15 @@
             <dt><strong>요금·허용 여부</strong></dt><dd>무료 주차나 개방 공간이 차박·텐트 허용을 뜻하지 않으므로 관리기관에 확인하세요.</dd>
             <dt><strong>최종 재검토</strong></dt><dd>2026년 10월 14일</dd>
         </dl>
-        <nav aria-label="경기도 수익 상위 캠핑 가이드"><a href="/kor/report/camp/namyangju.html">남양주 캠핑</a> · <a href="/kor/report/camp/goyang.html">고양 캠핑</a> · <a href="/kor/report/camp/uijeongbu.html">의정부 캠핑</a></nav>
+        <nav class="camp-next-reading" aria-labelledby="camp-next-reading-title">
+<h2 id="camp-next-reading-title">다음으로 무엇을 확인할까요?</h2>
+<p>장소를 비교 중인지, 겨울 일정이나 준비물을 정할 차례인지에 따라 필요한 안내를 선택하세요.</p>
+<ul>
+<li><a href="/kor/report/camp/pyeongtaek.html"><strong>등록 야영장 대안 비교 →</strong><span>평택의 소풍정원·진위천 등 시설별 확인 사항을 읽어보세요.</span></a></li>
+<li><a href="/kor/report/camp/winter-public-campsites-2026.html"><strong>겨울 운영·휴장 먼저 확인 →</strong><span>공공 야영장 요금과 운영 확인 등급을 비교하세요. 잔여석은 예약처에서 확인해야 합니다.</span></a></li>
+<li><a href="/kor/util/camping-packing-checklist/"><strong>인원·계절별 준비물 만들기 →</strong><span>숙박일과 캠핑 방식에 맞춰 짐 목록을 만들고 인쇄할 수 있습니다.</span></a></li>
+</ul>
+</nav>
     </section>
 <!-- emfls-manual-ad: in-article -->
 <aside class="emfls-manual-ad" aria-label="광고" style="display:block;width:100%;max-width:100%;margin:32px auto;padding:8px 0;text-align:center;">
diff --git a/kor/report/camp/jeongseon.html b/kor/report/camp/jeongseon.html
index e91280a8..102a6320 100644
--- a/kor/report/camp/jeongseon.html
+++ b/kor/report/camp/jeongseon.html
@@ -270,6 +270,10 @@
             }
         }
     /* 홈 버튼 스타일 */.home-button-container {position: fixed;bottom: 20px;left: 50%;transform: translateX(-50%);z-index: 1000;}.home-button {display: inline-flex;align-items: center;justify-content: center;background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);color: white;text-decoration: none;padding: 12px 24px;border-radius: 50px;font-weight: 600;font-size: 16px;box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);transition: all 0.3s ease;border: none;cursor: pointer;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;}.home-button:hover {transform: translateY(-2px);box-shadow: 0 6px 25px rgba(102, 126, 234, 0.4);color: white;text-decoration: none;}.home-button:active {transform: translateY(0);}.home-icon {margin-right: 8px;font-size: 18px;}/* 모바일 대응 */@media (max-width: 768px) {.home-button-container {    bottom: 15px;}.home-button {    padding: 10px 20px;    font-size: 14px;}.home-icon {    font-size: 16px;}}</style>
+
+<style id="camp-next-reading-style">
+.camp-next-reading{margin:20px 0;padding:18px;border:1px solid #bacbd2;border-radius:12px;background:#f4f8fa;color:#172d3b;line-height:1.65}.camp-next-reading h2{font-size:1.15rem;margin:0 0 8px;color:#172d3b}.camp-next-reading p{margin:0 0 12px}.camp-next-reading ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}.camp-next-reading a{display:block;padding:14px;border:1px solid #bacbd2;border-radius:8px;background:#fff;color:#164c74;text-decoration:underline;text-underline-offset:3px}.camp-next-reading a:focus-visible{outline:3px solid #a65000;outline-offset:3px}.camp-next-reading strong,.camp-next-reading span{display:block}.camp-next-reading span{font-size:.9rem;color:#354b59;margin-top:5px}
+</style>
 </head>
 <body><!-- 홈 버튼 --><div class="home-button-container"><a href="index.html" class="home-button">    <span class="home-icon">🏠</span>    홈으로</a></div>
     <div class="container">
@@ -288,7 +292,15 @@
                 <dt><strong>요금·허용 여부</strong></dt><dd>무료 이용 가능성과 숙박·텐트 허용 여부는 별개이므로 관리기관에 확인하세요.</dd>
                 <dt><strong>시설별 운영 정보 확인 기준</strong></dt><dd>2026년 8월 11일; 표현·법령 안내 검토 2026년 10월 15일</dd>
             </dl>
-            <nav aria-label="정선 인근 캠핑 가이드"><a href="/kor/report/camp/gangwon-best.html">강원도 캠핑 BEST</a> · <a href="/kor/report/camp/taebaek.html">태백 캠핑</a> · <a href="/kor/report/camp/pyeongchang.html">평창 캠핑</a></nav>
+            <nav class="camp-next-reading" aria-labelledby="camp-next-reading-title">
+<h2 id="camp-next-reading-title">다음으로 무엇을 확인할까요?</h2>
+<p>장소를 비교 중인지, 겨울 일정이나 준비물을 정할 차례인지에 따라 필요한 안내를 선택하세요.</p>
+<ul>
+<li><a href="/kor/report/camp/cheorwon.html"><strong>철원 캠핑 이용조건 비교 →</strong><span>금지·제한 구역과 등록 시설의 차이를 살펴보세요.</span></a></li>
+<li><a href="/kor/report/camp/winter-public-campsites-2026.html"><strong>겨울 운영·휴장 먼저 확인 →</strong><span>공공 야영장 요금과 운영 확인 등급을 비교하세요. 잔여석은 예약처에서 확인해야 합니다.</span></a></li>
+<li><a href="/kor/util/camping-packing-checklist/"><strong>인원·계절별 준비물 만들기 →</strong><span>숙박일과 캠핑 방식에 맞춰 짐 목록을 만들고 인쇄할 수 있습니다.</span></a></li>
+</ul>
+</nav>
         </section>
 <!-- emfls-manual-ad: in-article -->
 <aside class="emfls-manual-ad" aria-label="광고" style="display:block;width:100%;max-width:100%;margin:32px auto;padding:8px 0;text-align:center;">
diff --git a/kor/report/camp/pyeongtaek.html b/kor/report/camp/pyeongtaek.html
index b631bae2..9e5a63ab 100644
--- a/kor/report/camp/pyeongtaek.html
+++ b/kor/report/camp/pyeongtaek.html
@@ -310,6 +310,10 @@
             }
         }
     /* 홈 버튼 스타일 */.home-button-container {position: fixed;bottom: 20px;left: 50%;transform: translateX(-50%);z-index: 1000;}.home-button {display: inline-flex;align-items: center;justify-content: center;background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);color: white;text-decoration: none;padding: 12px 24px;border-radius: 50px;font-weight: 600;font-size: 16px;box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);transition: all 0.3s ease;border: none;cursor: pointer;font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;}.home-button:hover {transform: translateY(-2px);box-shadow: 0 6px 25px rgba(102, 126, 234, 0.4);color: white;text-decoration: none;}.home-button:active {transform: translateY(0);}.home-icon {margin-right: 8px;font-size: 18px;}/* 모바일 대응 */@media (max-width: 768px) {.home-button-container {    bottom: 15px;}.home-button {    padding: 10px 20px;    font-size: 14px;}.home-icon {    font-size: 16px;}}</style>
+
+<style id="camp-next-reading-style">
+.camp-next-reading{margin:20px 0;padding:18px;border:1px solid #bacbd2;border-radius:12px;background:#f4f8fa;color:#172d3b;line-height:1.65}.camp-next-reading h2{font-size:1.15rem;margin:0 0 8px;color:#172d3b}.camp-next-reading p{margin:0 0 12px}.camp-next-reading ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}.camp-next-reading a{display:block;padding:14px;border:1px solid #bacbd2;border-radius:8px;background:#fff;color:#164c74;text-decoration:underline;text-underline-offset:3px}.camp-next-reading a:focus-visible{outline:3px solid #a65000;outline-offset:3px}.camp-next-reading strong,.camp-next-reading span{display:block}.camp-next-reading span{font-size:.9rem;color:#354b59;margin-top:5px}
+</style>
 </head>
 <body><!-- 홈 버튼 --><div class="home-button-container"><a href="index.html" class="home-button">    <span class="home-icon">🏠</span>    홈으로</a></div>
     <div class="container">
@@ -328,7 +332,15 @@
                 <dt><strong>요금·허용 여부</strong></dt><dd>무료 구간이나 주차 정보가 합법 야영을 보장하지 않습니다. 등록 시설은 최신 예약 요금을 확인하세요.</dd>
                 <dt><strong>최종 재검토</strong></dt><dd>2026-10-14 · 평택시 공고의 지정 구간과 캠핑장 운영 공지를 확인하세요.</dd>
             </dl>
-            <nav aria-label="경기 지역 캠핑 가이드"><a href="/kor/report/camp/gyeonggi-best.html">경기 추천</a> · <a href="/kor/report/camp/goyang.html">고양</a> · <a href="/kor/report/camp/namyangju.html">남양주</a> · <a href="/kor/report/camp/free-camping-top20.html">전국 무료캠핑 비교</a></nav>
+            <nav class="camp-next-reading" aria-labelledby="camp-next-reading-title">
+<h2 id="camp-next-reading-title">다음으로 무엇을 확인할까요?</h2>
+<p>장소를 비교 중인지, 겨울 일정이나 준비물을 정할 차례인지에 따라 필요한 안내를 선택하세요.</p>
+<ul>
+<li><a href="/kor/report/camp/gyeonggi-best.html"><strong>경기도 다른 후보 비교 →</strong><span>다른 지역의 방문 정보와 야영 허용 여부를 구분해 보세요.</span></a></li>
+<li><a href="/kor/report/camp/winter-public-campsites-2026.html"><strong>겨울 운영·휴장 먼저 확인 →</strong><span>공공 야영장 요금과 운영 확인 등급을 비교하세요. 잔여석은 예약처에서 확인해야 합니다.</span></a></li>
+<li><a href="/kor/util/camping-packing-checklist/"><strong>인원·계절별 준비물 만들기 →</strong><span>숙박일과 캠핑 방식에 맞춰 짐 목록을 만들고 인쇄할 수 있습니다.</span></a></li>
+</ul>
+</nav>
         </section>
         <p style="margin:-12px 0 24px"><a href="/kor/report/camp/">전국 캠핑 가이드 전체 보기</a> · <a href="https://www.gocamping.or.kr/" target="_blank" rel="noopener noreferrer">고캠핑 공식 정보</a></p>
 <!-- emfls-manual-ad: in-article -->

```
