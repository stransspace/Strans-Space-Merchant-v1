import http from 'http'

function makeRequest(url) {
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

console.log('\n' + '='.repeat(60))
console.log('📊 LAPORAN TRANSAKSI POS COFFEE')
console.log('='.repeat(60) + '\n')

try {
  // Get Summary
  const summary = await makeRequest('http://localhost:4000/api/reports/summary')
  const overall = summary.overall

  console.log('📈 RINGKASAN KESELURUHAN')
  console.log('-'.repeat(60))
  console.log(`  Total Transaksi        : ${overall.totalOrders} orders`)
  console.log(`  Total Revenue          : Rp. ${Number(overall.totalRevenue).toLocaleString('id-ID')}`)
  console.log(`  Rata-rata per Order    : Rp. ${Number(overall.avgOrderValue).toLocaleString('id-ID')}`)
  console.log(`  Total Items Terjual    : ${overall.totalItemsSold} items`)
  console.log(`  Jumlah Hari Aktif      : ${overall.totalDaysActive} hari`)
  console.log(`  Produk Unik Terjual    : ${overall.totalProductsSold} produk`)

  console.log('\n💳 BREAKDOWN METODE PEMBAYARAN')
  console.log('-'.repeat(60))
  let totalByMethod = 0
  summary.paymentSummary.forEach(pay => {
    const total = Number(pay.total)
    totalByMethod += total
    const percentage = ((total / Number(overall.totalRevenue)) * 100).toFixed(1)
    console.log(`  ${pay.paymentMethod.padEnd(12)} : ${pay.count} transaksi → Rp. ${total.toLocaleString('id-ID').padStart(12)} (${percentage}%)`)
  })

  console.log('\n🏆 TOP 10 PRODUK TERLARIS')
  console.log('-'.repeat(60))
  console.log(`  No  Produk                                      Qty  Revenue`)
  console.log('-'.repeat(60))
  summary.topProducts.forEach((prod, idx) => {
    const name = `${prod.name} (${prod.variantName})`
    const padded = name.length > 42 ? name.substring(0, 39) + '...' : name.padEnd(42)
    const revenue = Number(prod.revenue).toLocaleString('id-ID')
    console.log(`  ${String(idx + 1).padStart(2)}  ${padded}  ${String(prod.totalQty).padStart(3)}  Rp. ${revenue}`)
  })

  // Get Daily
  const daily = await makeRequest('http://localhost:4000/api/reports/daily')
  if (daily.length > 0) {
    console.log('\n📅 TRANSAKSI PER HARI')
    console.log('-'.repeat(60))
    daily.forEach(day => {
      console.log(`  ${day.date} : ${day.totalOrders} transaksi, ${day.totalItemsSold} items, Rp. ${Number(day.totalRevenue).toLocaleString('id-ID')}`)
    })
  }

  // Get Weekly
  const weekly = await makeRequest('http://localhost:4000/api/reports/weekly')
  if (weekly.length > 0) {
    console.log('\n📆 TRANSAKSI PER MINGGU')
    console.log('-'.repeat(60))
    weekly.forEach(week => {
      console.log(`  Week ${week.weekNum} (${week.year}) : ${week.totalOrders} transaksi, ${week.totalItemsSold} items, Rp. ${Number(week.totalRevenue).toLocaleString('id-ID')}`)
    })
  }

  // Get Monthly
  const monthly = await makeRequest('http://localhost:4000/api/reports/monthly')
  if (monthly.length > 0) {
    console.log('\n📊 TRANSAKSI PER BULAN')
    console.log('-'.repeat(60))
    monthly.forEach(month => {
      console.log(`  ${month.month} : ${month.totalOrders} transaksi, ${month.totalItemsSold} items, Rp. ${Number(month.totalRevenue).toLocaleString('id-ID')}`)
    })
  }

  // Get Yearly
  const yearly = await makeRequest('http://localhost:4000/api/reports/yearly')
  if (yearly.length > 0) {
    console.log('\n📈 TRANSAKSI PER TAHUN')
    console.log('-'.repeat(60))
    yearly.forEach(year => {
      console.log(`  ${year.year} : ${year.totalOrders} transaksi, ${year.totalItemsSold} items, Rp. ${Number(year.totalRevenue).toLocaleString('id-ID')}`)
    })
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Laporan berhasil dimuat!')
  console.log('='.repeat(60) + '\n')

} catch (err) {
  console.error('❌ Error:', err.message)
}
