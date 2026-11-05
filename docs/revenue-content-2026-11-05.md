# Camping/travel exact-transition approval — 2026-11-05

The owner delegated immediate researched improvements on 2026-11-05. Preserve 48/day, 30-minute publication, queue, ads and GA4. Revenue uplift is unmeasured.

Approve only the exact two camping blob pairs in APPROVED_NOVEMBER_5_CAMPING_TRANSITIONS; changed inputs/outputs, reverse transitions and unrelated WINNER changes remain blocked. Source-reviewed content will be a separate PR after this approval reaches main.

Sources reviewed 2026-11-05:
- https://gocamping.or.kr/bsite/camp/info/read.do?c_no=1736 — registered address, 45 general sites, spring/summer/autumn operation; registration updated 2025-12-19.
- https://www.campingtalk.me/pubsec/camp/3827/main — linked booking route only; live prices, availability and winter operation unverified.
- https://www.museumshop.or.kr/kor/main.do — official merchandise categories; individual store stock unverified.
- https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=248765 — purchase/refund sequence; no new monetary eligibility threshold asserted.

Gyeonggi adds a registered alternative distinct from unverified wild-camping candidates. Pyeongtaek corrects the address and explains booking/vehicle/winter checks. Souvenir aligns unsupported popularity claims with the existing title and adds budget/purchasing guidance. URLs, title tags, canonicals, advertising, GA4 and non-schema scripts are preserved.

Focused exact-transition regression: RED (missing approval) then GREEN, including changed input/output, reversed pairs and unrelated WINNER blocking.

## Complete proposed content patch

```diff
diff --git a/kor/report/camp/gyeonggi-best.html b/kor/report/camp/gyeonggi-best.html
index 61d9465..4ba2161 100644
--- a/kor/report/camp/gyeonggi-best.html
+++ b/kor/report/camp/gyeonggi-best.html
@@ -94,6 +94,12 @@
 
 
     <div class="intro"><p>아래 10곳은 관광·자연 명소로 소개된 장소입니다. 이 목록에서 공식 등록 캠핑장으로 확인된 곳은 없으며, 개별 야영 허용도 확인되지 않았습니다. 장소 방문 정보와 숙박·야영 허가를 구분하세요.</p><p><strong>① 정식 등록 캠핑장:</strong> 이 목록에서 확인된 곳 없음 · <strong>② 금지·제한 구역:</strong> 구역별 고시·출입 제한을 별도 확인 · <strong>③ 허용 미확인 후보:</strong> 아래 10곳</p></div>
+    <section class="intro" aria-labelledby="registered-alternative">
+        <h2 id="registered-alternative">숙박이 목적이라면 등록 야영장부터 비교하세요</h2>
+        <p>아래 10곳의 야영 허용을 확인하지 못했다면, 별도 대안인 <strong>평택 소풍정원 캠핑장</strong>을 비교할 수 있습니다. 한국관광공사 고캠핑에는 평택시 운영 일반야영장 45면으로 등록되어 있으며 온라인 예약처가 연결되어 있습니다. 아래 노지 후보가 허용 장소로 바뀌었다는 뜻은 아닙니다.</p>
+        <p>등록 운영기간은 봄·여름·가을입니다. 겨울 숙박은 예약 가능한 날짜와 운영처 안내를 확인한 뒤 결정하세요. <a href="/kor/report/camp/pyeongtaek.html">평택 캠핑장별 확인 사항</a>에서 진위천·소풍정원 등 후보를 함께 비교할 수 있습니다.</p>
+        <p><small>근거: <a href="https://gocamping.or.kr/bsite/camp/info/read.do?c_no=1736">고캠핑 소풍정원 등록정보</a> (자료 수정일 2025-12-19) · 이 대안 정보 확인일 2026-11-05. 현재 잔여석·동계 운영은 미확인입니다.</small></p>
+    </section>
     <div class="spots-grid">
         <div class="spot-card">
             <h2>⛵ 김포 전류리포구</h2>
diff --git a/kor/report/camp/pyeongtaek.html b/kor/report/camp/pyeongtaek.html
index 17c6310..b631bae 100644
--- a/kor/report/camp/pyeongtaek.html
+++ b/kor/report/camp/pyeongtaek.html
@@ -363,10 +363,13 @@
             </div>
             <div class="camping-card">
                 <h2>🌸 소풍정원 캠핑장</h2>
-                <div class="address">📍 경기 평택시 고덕면 궁리 424-25</div>
+                <div class="address">📍 경기 평택시 고덕면 새악길 43-42 (고캠핑 등록 도로명주소)</div>
                 <p><strong>① 고캠핑 등록 캠핑장</strong></p>
                 <p>고캠핑 등록 운영기간은 봄·여름·가을이므로 “연중무휴”가 아닙니다. 등록 요금은 일반 3만원, 평택시민 2만원으로 안내되며 온라인 실시간 예약 정보가 있습니다. 등록 전화번호는 031-668-4812입니다. 동계 운영·시설 가동 여부는 운영처에서 확인하세요.</p>
                 <p><small>출처: <a href="https://gocamping.or.kr/bsite/camp/info/read.do?c_no=1736">한국관광공사 고캠핑 소풍정원</a> · 수정일 2025-12-19 · 확인일 2026-10-14</small></p>
+                <p><strong>예약 전 확인할 점:</strong> 고캠핑에는 평택시 운영 일반야영장 45면으로 등록되어 있으며, 예약페이지는 <a href="https://www.campingtalk.me/pubsec/camp/3827/main">소풍정원 캠핑톡 예약처</a>로 연결됩니다. 먼저 날짜별 판매 여부와 사이트 유형을 확인하고, 결제 전에 최종 요금·취소 조건을 확인하세요. 일반야영장 등록만으로 차량을 사이트 옆에 댈 수 있다고 판단하지 마세요.</p>
+                <p>11월 이후 일정을 잡는다면 등록상 봄·여름·가을 운영과 실제 예약 가능일을 구분하세요. 겨울 개장·온수·샤워 시설 가동은 확인되지 않았으므로 필요 시설과 운영일을 031-668-4812에 확인한 뒤 장비를 준비하세요.</p>
+                <p><small>주소·예약 경로 보완 확인일 2026-11-05: 위 고캠핑 등록정보와 연결 예약처 기준. 현재 잔여석·예약 개시일·동계 운영은 미확인입니다.</small></p>
             </div>
             <div class="camping-card">
                 <h2>🌳 내리캠핑장 (내리문화공원)</h2>
diff --git a/kor/report/travel/korean-souvenir-foreigners-2026.html b/kor/report/travel/korean-souvenir-foreigners-2026.html
index 0726238..de0396f 100644
--- a/kor/report/travel/korean-souvenir-foreigners-2026.html
+++ b/kor/report/travel/korean-souvenir-foreigners-2026.html
@@ -11,29 +11,29 @@
 <meta name="keywords" content="한국기념품, 외국인쇼핑, K-상품">
 <link rel="canonical" href="https://emfls.github.io/kor/report/travel/korean-souvenir-foreigners-2026.html">
 <style>.adsbygoogle{max-width:100%;overflow:hidden}.wrap{max-width:900px;margin:auto;padding:24px;line-height:1.7}.section,section{margin:24px 0;padding:20px;border:1px solid #e2e8f0;border-radius:12px}.souvenir-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;padding:0;list-style:none}.souvenir-list li{padding:14px;background:#f8fafc;border-radius:10px}.guide-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.guide-grid div{padding:14px;background:#f8fafc;border-radius:10px}.jump-links{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.jump-links a{padding:8px 12px;background:#eff6ff;border-radius:999px;text-decoration:none}.table-wrap{overflow-x:auto}.quick-pick{width:100%;border-collapse:collapse;min-width:620px}.quick-pick th,.quick-pick td{padding:10px;border:1px solid #dbe3ec;text-align:left}.quick-pick th{background:#eff6ff}a{overflow-wrap:anywhere}</style>
-<meta property="og:title" content="외국인들이 한국 오면 꼭 사가는 것들 19가지, 우리가 모르던 것도 있다">
-<meta property="og:description" content="한국을 방문한 외국인이 가장 많이 구매하는 기념품과 쇼핑 아이템 19가지입니다.">
+<meta property="og:title" content="한국 기념품 추천 19가지 2026 | 외국인 선물·구매처·주의사항">
+<meta property="og:description" content="받는 사람의 취향과 짐의 부피에 맞춰 고르는 한국 기념품 19가지입니다. 공식 구매처와 출국 전 확인사항을 함께 안내합니다.">
 <meta property="og:url" content="https://emfls.github.io/kor/report/travel/korean-souvenir-foreigners-2026.html">
 <meta property="og:type" content="article">
 <script type="application/ld+json">
-{"@context":"https://schema.org","@type":"WebPage","headline":"외국인들이 한국 오면 꼭 사가는 것들 19가지, 우리가 모르던 것도 있다",
-"description":"한국을 방문한 외국인이 가장 많이 구매하는 기념품과 쇼핑 아이템 19가지입니다.","datePublished":"2026-05-29",
-"dateModified":"2026-08-25","url":"https://emfls.github.io/kor/report/travel/korean-souvenir-foreigners-2026.html"}
+{"@context":"https://schema.org","@type":"WebPage","headline":"한국 기념품 추천 19가지 2026 | 외국인 선물·구매처·주의사항",
+"description":"받는 사람의 취향과 짐의 부피에 맞춰 고르는 한국 기념품 19가지입니다. 공식 구매처와 출국 전 확인사항을 함께 안내합니다.","datePublished":"2026-05-29",
+"dateModified":"2026-11-05","url":"https://emfls.github.io/kor/report/travel/korean-souvenir-foreigners-2026.html"}
 </script>
 </head>
 <body>
 <div class="wrap">
   <div class="breadcrumb">
-    <a href="https://emfls.github.io">홈</a> › <a href="https://emfls.github.io/kor/report/travel/index.html">TRAVEL</a> › 외국인들이 한국 오면 꼭 사가는 것들 19가지, 우리가…
+    <a href="https://emfls.github.io">홈</a> › <a href="https://emfls.github.io/kor/report/travel/index.html">TRAVEL</a> › 한국 기념품 추천 19가지
   </div>
 
   <header>
-    <h1>🇰🇷 외국인들이 한국 오면 꼭 사가는 것들 19가지, 우리가 모르던 것도 있다</h1>
-    <p><strong>최근 검토: 2026-08-25.</strong> 인기·재고·가격은 매장과 시기에 따라 달라집니다. 식품·화장품은 도착 국가의 세관·검역 규정과 항공사 수하물 기준을 확인하세요.</p>
-    <div class="sub">한국을 방문한 외국인이 가장 많이 구매하는 기념품과 쇼핑 아이템 19가지입니다.</div>
+    <h1>🇰🇷 한국 기념품 추천 19가지 2026 | 외국인 선물·구매처·주의사항</h1>
+    <p><strong>최근 검토: 2026-11-05.</strong> 인기·재고·가격은 매장과 시기에 따라 달라집니다. 식품·화장품은 도착 국가의 세관·검역 규정과 항공사 수하물 기준을 확인하세요.</p>
+    <div class="sub">받는 사람의 취향과 짐의 부피에 맞춰 고르는 한국 기념품 19가지입니다. 공식 구매처와 출국 전 확인사항을 함께 안내합니다.</div>
     <div class="badges">
       <span class="badge">#한국기념품</span><span class="badge">#외국인쇼핑</span><span class="badge">#K-상품</span>
-      <span class="badge">📅 2026년 05월 29일 업데이트</span>
+      <span class="badge">📅 2026년 11월 05일 구매 안내 보완</span>
     </div>
   </header>
 
@@ -42,6 +42,7 @@
   <nav class="jump-links" aria-label="페이지 바로가기">
     <a href="#quick-pick">30초 선택표</a>
     <a href="#souvenir-list-title">기념품 19가지</a>
+    <a href="#shopping-route">예산·구매 순서</a>
     <a href="#shopping-checklist">구매·출국 체크</a>
     <a href="#related-travel">관련 여행 정보</a>
   </nav>
@@ -86,6 +87,18 @@
     </ul>
   </section>
 
+  <section class="section" id="shopping-route">
+    <h2>예산부터 정하고 구매처를 좁히세요</h2>
+    <p>아래 금액은 상품의 판매가가 아니라 <strong>선물 예산을 나누는 예시</strong>입니다. 총예산 5만 원으로 10명에게 나누면 1인당 5천 원, 2명에게 주면 1인당 2만 5천 원입니다. 포장비와 배송비도 총액에 포함하세요.</p>
+    <ol>
+      <li><strong>받는 사람 수와 남은 짐 공간을 먼저 정합니다.</strong> 여러 명에게는 문구·엽서 같은 작고 가벼운 품목을, 취향을 아는 한 사람에게는 공예품·생활 소품을 먼저 비교하세요.</li>
+      <li><strong>공식 상품 목록에서 후보 2~3개를 고릅니다.</strong> <a href="https://www.museumshop.or.kr/kor/main.do" target="_blank" rel="noopener noreferrer">국립박물관 뮷즈 공식 온라인숍</a>에서 문구·책갈피·파우치·도자기 등 유형별 상품을 확인할 수 있습니다. 온라인 상품 정보만으로 방문 매장의 재고를 판단하지 마세요.</li>
+      <li><strong>출국까지 여유가 적으면 수령 가능 여부부터 확인합니다.</strong> 배송 상품은 출고일과 숙소 수령 가능일을 확인하고, 현장 구매는 방문할 매장에 원하는 상품의 재고·영업시간·포장 가능 여부를 확인한 뒤 이동하세요.</li>
+      <li><strong>환급을 받을 계획이면 결제 전에 요청합니다.</strong> 매장의 환급 취급 여부와 필요한 서류를 확인하고 영수증을 보관하세요. 적용 대상과 출국 절차는 <a href="https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=248765" target="_blank" rel="noopener noreferrer">한국관광공사 세금 환급 안내</a>에서 확인합니다.</li>
+    </ol>
+    <p><small>공식 상품 분류·환급 안내 확인: 2026-11-05. 개별 상품의 당일 재고와 도착국 반입 허용 여부를 보증하는 목록은 아닙니다.</small></p>
+  </section>
+
   <section class="section" id="shopping-checklist" data-shopping-guide="souvenir">
     <h2>구매 장소·가격·출국 전 체크</h2>
     <div class="guide-grid">
diff --git a/tests/test_korean_souvenir_revenue_page.py b/tests/test_korean_souvenir_revenue_page.py
index 05d2f61..b86a01d 100644
--- a/tests/test_korean_souvenir_revenue_page.py
+++ b/tests/test_korean_souvenir_revenue_page.py
@@ -59,7 +59,7 @@ class KoreanSouvenirRevenuePageTest(unittest.TestCase):
         ):
             self.assertIn(link, self.parser.links)
         self.assertTrue(
-            any(item.get("dateModified") == "2026-08-25" for item in self.parser.json_ld)
+            any(item.get("dateModified") == "2026-11-05" for item in self.parser.json_ld)
         )
 
 
diff --git a/tests/test_korean_souvenir_revenue_path.py b/tests/test_korean_souvenir_revenue_path.py
index 8d9dfe3..aab404b 100644
--- a/tests/test_korean_souvenir_revenue_path.py
+++ b/tests/test_korean_souvenir_revenue_path.py
@@ -21,7 +21,7 @@ class KoreanSouvenirRevenuePathTest(unittest.TestCase):
 
         schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
         page_schema = next(item for item in map(json.loads, schemas) if item.get("@type") == "WebPage")
-        self.assertEqual("2026-08-25", page_schema["dateModified"])
+        self.assertEqual("2026-11-05", page_schema["dateModified"])
 
 
 if __name__ == "__main__":

```
