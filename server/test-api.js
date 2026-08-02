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

console.log('📋 Testing API Endpoints...\n')

// Test GET /orders
console.log('1. GET /orders')
const orders = await makeRequest('http://localhost:4000/api/orders')
console.log(`   Found ${orders.length} orders`)
orders.forEach(o => {
  console.log(`   - Order #${o.id} | ${o.paymentMethod} | ${o.totalItems} items | Total: Rp. ${o.totalPrice?.toLocaleString('id-ID') || 0}`)
})

console.log('\n2. GET /orders/1 (with variant details)')
const order1 = await makeRequest('http://localhost:4000/api/orders/1')
console.log(`   Order #${order1.id}`)
console.log(`   Payment: ${order1.paymentMethod} (Rp. ${order1.cash.toLocaleString('id-ID')})`)
console.log(`   Items:`)
order1.items.forEach(item => {
  console.log(`     - ${item.name}${item.variantName ? ` (${item.variantName})` : ''} x${item.qty} @ Rp. ${item.priceEach.toLocaleString('id-ID')}`)
})

console.log('\n3. GET /orders/8 (order with multiple items)')
const order8 = await makeRequest('http://localhost:4000/api/orders/8')
console.log(`   Order #${order8.id} | ${order8.paymentMethod}`)
console.log(`   Items (${order8.items.length} items):`)
order8.items.forEach(item => {
  console.log(`     - ${item.name}${item.variantName ? ` (${item.variantName})` : ''} x${item.qty}`)
})

console.log('\n✅ API test completed!')
