const baseUrl = 'http://localhost:5000/coffeV3'

async function run() {
  try {
    const resDaily = await fetch(`${baseUrl}/api/reports/daily`)
    const daily = await resDaily.json()
    console.log('Daily list examples (first 2):')
    console.log(JSON.stringify(daily.slice(0, 2), null, 2))
    
    if (daily.length > 0) {
      const targetDate = daily[0].date // e.g. "2026-06-05T17:00:00.000Z" or similar
      console.log(`\nFetching detail for date: ${targetDate}`)
      const resDetail = await fetch(`${baseUrl}/api/reports/daily/${targetDate}`)
      const detail = await resDetail.json()
      console.log('Detail response keys:', Object.keys(detail))
      console.log('Detail orders count:', detail.orders?.length)
      console.log('Detail summary:', detail.summary)
    }
  } catch (err) {
    console.error(err)
  }
}

run()
