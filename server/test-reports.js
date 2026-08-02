import http from 'http'

function makeRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = new URL(url)
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          resolve(data)
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

console.log('\n📊 TESTING REPORT ENDPOINTS\n')

try {
  // Test Summary
  console.log('1. GET /api/reports/summary')
  const summary = await makeRequest('http://localhost:4000/api/reports/summary')
  console.log('   Overall:')
  console.log(`     - Total Orders: ${summary.overall[0].totalOrders}`)
  console.log(`     - Total Revenue: Rp. ${summary.overall[0].totalRevenue.toLocaleString('id-ID')}`)
  console.log(`     - Avg Order Value: Rp. ${summary.overall[0].avgOrderValue.toLocaleString('id-ID')}`)
  console.log(`     - Total Items Sold: ${summary.overall[0].totalItemsSold}`)

  console.log('   Payment Methods:')
  summary.paymentSummary.forEach(p => {
    console.log(`     - ${p.paymentMethod}: ${p.count} orders (Rp. ${p.total.toLocaleString('id-ID')})`)
  })

  console.log('   Top 5 Products:')
  summary.topProducts.slice(0, 5).forEach((prod, idx) => {
    console.log(`     ${idx + 1}. ${prod.name}${prod.variantName ? ` (${prod.variantName})` : ''} - ${prod.totalQty} terjual (Rp. ${prod.revenue.toLocaleString('id-ID')})`)
  })

  // Test Daily
  console.log('\n2. GET /api/reports/daily')
  const daily = await makeRequest('http://localhost:4000/api/reports/daily')
  console.log(`   Found ${daily.length} days with transactions:`)
  daily.forEach(d => {
    console.log(`     - ${d.date}: ${d.totalOrders} orders, Rp. ${d.totalRevenue.toLocaleString('id-ID')}`)
  })

  // Test Weekly
  console.log('\n3. GET /api/reports/weekly')
  const weekly = await makeRequest('http://localhost:4000/api/reports/weekly')
  console.log(`   Found ${weekly.length} weeks with transactions:`)
  weekly.forEach(w => {
    console.log(`     - Week ${w.weekNum} ${w.year}: ${w.totalOrders} orders, Rp. ${w.totalRevenue.toLocaleString('id-ID')}`)
  })

  // Test Monthly
  console.log('\n4. GET /api/reports/monthly')
  const monthly = await makeRequest('http://localhost:4000/api/reports/monthly')
  console.log(`   Found ${monthly.length} months with transactions:`)
  monthly.forEach(m => {
    console.log(`     - ${m.month}: ${m.totalOrders} orders, Rp. ${m.totalRevenue.toLocaleString('id-ID')}`)
  })

  // Test Yearly
  console.log('\n5. GET /api/reports/yearly')
  const yearly = await makeRequest('http://localhost:4000/api/reports/yearly')
  console.log(`   Found ${yearly.length} years with transactions:`)
  yearly.forEach(y => {
    console.log(`     - ${y.year}: ${y.totalOrders} orders, Rp. ${y.totalRevenue.toLocaleString('id-ID')}`)
  })

  console.log('\n✅ All report endpoints working!\n')
} catch (err) {
  console.error('❌ Error:', err.message)
}
