import json,re,subprocess,unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TOOLS={
 "hourly-salary-calculator":("Hourly Salary Calculator","calculateHourlySalary"),
 "overtime-pay-calculator":("Overtime Pay Calculator","calculateOvertimePay"),
 "commission-calculator":("Commission Calculator","calculateCommission"),
 "break-even-calculator":("Break-even Calculator","calculateBreakEven"),
 "roi-calculator":("ROI Calculator","calculateRoi"),
 "electricity-cost-calculator":("Electricity Cost Calculator","calculateElectricityCost"),
 "download-time-calculator":("Download Time Calculator","calculateDownloadTime"),
 "grade-calculator":("Grade Calculator","calculateGrade"),
 "weighted-average-calculator":("Weighted Average Calculator","calculateWeightedAverage"),
 "recipe-scaler":("Recipe Scaler","scaleRecipe"),
}
def run(slug,expression):
 html=(ROOT/'util'/slug/'index.html').read_text(); block=re.search(r'<!-- PURE_START -->(.*?)<!-- PURE_END -->',html,re.S).group(1)
 out=subprocess.run(['node','-e',block+'\nconsole.log(JSON.stringify('+expression+'));'],capture_output=True,text=True,check=True)
 return json.loads(out.stdout)
class SecondTenNewRevenueToolsTest(unittest.TestCase):
 def test_publication_and_discovery(self):
  hub=(ROOT/'util/index.html').read_text(); sitemap=(ROOT/'util/sitemap.xml').read_text()
  for slug,(intent,marker) in TOOLS.items():
   with self.subTest(slug=slug):
    html=(ROOT/'util'/slug/'index.html').read_text(); compact=''.join(html.split())
    self.assertIn('<html lang="en">',html); self.assertIn(f'https://emfls.github.io/util/{slug}/',html)
    self.assertIn(intent,html); self.assertIn(marker,html); self.assertIn('Reviewed: 2026-08-11',html)
    self.assertIn('processed in your browser',html); self.assertIn('G-QP5Q67GE5B',html); self.assertIn('ca-pub-8830524482034754',html)
    self.assertIn('href="../new-tools.css"',html); self.assertNotRegex(html,r'\.innerHTML\s*=')
    schemas=[json.loads(x) for x in re.findall(r'<script type="application/ld\+json">(.*?)</script>',html,re.S)]
    self.assertEqual({'WebApplication','FAQPage'},{x.get('@type') for x in schemas}); self.assertIn(f'href="/util/{slug}/"',hub); self.assertIn(f'/util/{slug}/',sitemap)
 def test_calculations(self):
  self.assertEqual({'weekly':800,'monthly':3466.6666666666665,'annual':41600},run('hourly-salary-calculator','calculateHourlySalary(20,40,52)'))
  self.assertEqual({'regularPay':800,'overtimePay':300,'totalPay':1100},run('overtime-pay-calculator','calculateOvertimePay(20,40,10,1.5)'))
  self.assertEqual({'commission':500,'total':1500},run('commission-calculator','calculateCommission(10000,5,1000)'))
  self.assertEqual({'contribution':15,'units':67,'revenue':3350},run('break-even-calculator','calculateBreakEven(1000,50,35)'))
  self.assertEqual({'gain':500,'roi':50},run('roi-calculator','calculateRoi(1000,1500)'))
  self.assertEqual({'kwh':30,'cost':6},run('electricity-cost-calculator','calculateElectricityCost(1000,1,30,.2)'))
  self.assertEqual({'seconds':80},run('download-time-calculator',"calculateDownloadTime(100,'MB',10)"))
  self.assertEqual({'grade':85},run('grade-calculator','calculateGrade([{score:80,max:100,weight:50},{score:90,max:100,weight:50}])'))
  self.assertEqual({'average':17.5},run('weighted-average-calculator','calculateWeightedAverage([{value:10,weight:1},{value:20,weight:3}])'))
  self.assertEqual({'factor':2,'quantity':3},run('recipe-scaler','scaleRecipe(1.5,2,4)'))
 def test_invalid_cases(self):
  self.assertIn('error',run('break-even-calculator','calculateBreakEven(100,10,10)')); self.assertIn('error',run('roi-calculator','calculateRoi(0,10)')); self.assertIn('error',run('recipe-scaler','scaleRecipe(1,0,4)'))
if __name__=='__main__': unittest.main()
