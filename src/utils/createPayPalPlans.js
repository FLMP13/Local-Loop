// Script to create PayPal subscription plans programmatically
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PAYPAL_BASE_URL = 'https://api.sandbox.paypal.com'; // Sandbox
// const PAYPAL_BASE_URL = 'https://api.paypal.com'; // Live

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not found in environment variables');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await axios.post(`${PAYPAL_BASE_URL}/v1/oauth2/token`, 
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );
  
  return response.data.access_token;
}

// Function to create a PayPal product
async function createProduct() {
  const accessToken = await getAccessToken();
  
  const productData = {
    name: 'RentMate Premium',
    description: 'Premium subscription for RentMate platform',
    type: 'SERVICE',
    category: 'SOFTWARE'
  };

  // Ensure unique request ID to avoid duplicate product creation
  const response = await axios.post(`${PAYPAL_BASE_URL}/v1/catalogs/products`, productData, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': `PRODUCT-${Date.now()}`
    }
  });

  return response.data.id;
}

// Function to create a PayPal plan
async function createPlan(productId, planData) {
  const accessToken = await getAccessToken();
  
  const response = await axios.post(`${PAYPAL_BASE_URL}/v1/billing/plans`, planData, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': `PLAN-${Date.now()}-${planData.name.replace(/\s+/g, '')}`
    }
  });

  return response.data;
}

// Main function to create subscription plans
async function createSubscriptionPlans() {
  try {
    console.log('🔄 Creating PayPal subscription plans...\n');

    // Step 1: Create product
    console.log('📦 Creating product...');
    const productId = await createProduct();
    console.log(`✅ Product created: ${productId}\n`);

    // Step 2: Create monthly plan
    console.log('📅 Creating monthly plan...');
    const monthlyPlan = {
      product_id: productId,
      name: 'Premium Monthly',
      description: 'Monthly premium subscription for RentMate',
      status: 'ACTIVE',
      billing_cycles: [{
        frequency: {
          interval_unit: 'MONTH',
          interval_count: 1
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // Infinite
        pricing_scheme: {
          fixed_price: {
            value: '3.99',
            currency_code: 'EUR'
          }
        }
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    };

    const monthlyResult = await createPlan(productId, monthlyPlan);
    console.log(`✅ Monthly plan created: ${monthlyResult.id}\n`);

    // Step 3: Create yearly plan
    console.log('📅 Creating yearly plan...');
    const yearlyPlan = {
      product_id: productId,
      name: 'Premium Yearly',
      description: 'Yearly premium subscription for RentMate (save 25%)',
      status: 'ACTIVE',
      billing_cycles: [{
        frequency: {
          interval_unit: 'YEAR',
          interval_count: 1
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // Infinite
        pricing_scheme: {
          fixed_price: {
            value: '35.99',
            currency_code: 'EUR'
          }
        }
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    };

    const yearlyResult = await createPlan(productId, yearlyPlan);
    console.log(`✅ Yearly plan created: ${yearlyResult.id}\n`);

    // Display results
    console.log(' SUCCESS! Plans created successfully!\n');
    console.log(' Add these to your .env file:');
    console.log(`PAYPAL_MONTHLY_PLAN_ID=${monthlyResult.id}`);
    console.log(`PAYPAL_YEARLY_PLAN_ID=${yearlyResult.id}\n`);
    
    return {
      monthly: monthlyResult,
      yearly: yearlyResult
    };

  } catch (error) {
    console.error(' Error creating plans:', error.response?.data || error.message);
    throw error;
  }
}

// Run the script
createSubscriptionPlans()
  .then(plans => {
    console.log('Script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
