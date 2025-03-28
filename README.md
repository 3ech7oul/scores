# Score

## Install
To install all dependencies
` npm install  `

To run app in dev mode
` npm run start:dev`

To run tests
`npm test`

## Endpoints
Get aggregated data by user Id
```
curl --location 'http://localhost:3000/transactions/balance?user=63957'
```

Get list of requested payouts 
```
curl --location 'http://localhost:3000/transactions/payouts?user=63957'
```

Run Sync transaction manually
```
curl --location --request POST 'http://localhost:3000/transactions/sync?days=90'
```

Mock Transaction API with hardcoded user IDs: 74092, 85123, and 63957.
```
curl --location 'http://localhost:3000/mock-transactions/?startDate=2025-03-27%2012%3A02%3A51&endDate=2025-03-28%2012%3A03%3A20&page=1'
```