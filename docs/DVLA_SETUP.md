# DVLA Vehicle Lookup Setup

The car maintenance feature includes automatic vehicle data lookup using the UK DVLA (Driver and Vehicle Licensing Agency) API.

## Features

When adding a new car, you can enter a UK license plate (registration number) and the system will automatically fetch:
- Make and model
- Year of manufacture
- Vehicle color
- Fuel type
- MOT expiry date
- Tax status and due date

## Setup Instructions

### 1. Get a DVLA API Key

1. Visit the [DVLA Developer Portal](https://developer-portal.driver-vehicle-licensing.api.gov.uk/)
2. Create an account or sign in
3. Subscribe to the "Vehicle Enquiry API" service
4. Generate an API key

**Note:** This is a paid API service from the UK government. Check their pricing and terms before subscribing.

### 2. Configure the API Key

Add your API key to the backend `.env` file:

```bash
DVLA_API_KEY=your_api_key_here
```

### 3. Restart the Backend

After adding the API key, restart your FastAPI backend server:

```bash
cd backend
uvicorn main:app --reload
```

## Usage Without API Key

The license plate lookup feature will still work without an API key, but it will return a helpful message instructing you to:
1. Sign up at the DVLA Developer Portal
2. Add the API key to your `.env` file
3. Restart the server

You can still add cars manually by filling in all the fields in the add car form.

## API Endpoint

The lookup is available at:
```
GET /api/car/lookup/{license_plate}
```

Example response (with API key):
```json
{
  "found": true,
  "make": "TOYOTA",
  "model": "COROLLA",
  "year": 2018,
  "color": "Silver",
  "fuel_type": "Petrol",
  "mot_expiry": "2025-03-15",
  "tax_status": "Taxed",
  "tax_due": "2025-06-01",
  "license_plate": "AB12CDE"
}
```

Example response (without API key):
```json
{
  "found": false,
  "message": "DVLA API key not configured",
  "instructions": "To enable license plate lookup: 1. Sign up at https://developer-portal.driver-vehicle-licensing.api.gov.uk/ 2. Add DVLA_API_KEY to .env file 3. Restart server"
}
```

## Privacy & Data

- License plate lookups are made directly to the UK government DVLA API
- No vehicle data is stored unless you choose to add the car to your dashboard
- The DVLA API only works for UK-registered vehicles
