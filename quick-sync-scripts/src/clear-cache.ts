// src/clear-cache.ts

import { buildBasicAuth } from './lib/sync-helpers';

// Define the structure of our endpoints for type safety
const ENDPOINTS = {
    prod: 'https://four12global.com/wp-json/four12/v1/clear-cache',
    staging: 'https://wordpress-1204105-5660147.cloudwaysapps.com/wp-json/four12/v1/clear-cache'
};

// Define the SECRET_NAME
const SECRET_NAME = 'API-SYNC';

/**
 * Main function to orchestrate the cache clearing process.
 */
async function main() {
    // For Automations, input variables are configured in the UI.
    // input.config() is called with no arguments to retrieve them.
    const scriptInput = await input.config();
    const env = scriptInput.env as keyof typeof ENDPOINTS;

    if (!env || !ENDPOINTS[env]) {
        // Use console.error for immediate feedback in the test log
        console.error("Configuration Error! The 'env' input variable is missing or invalid. Please configure it in the Automation trigger/button settings.");
        // Set output variables for the automation run history
        output.set('status', 'Configuration Error');
        output.set('details', "The 'env' input variable is missing or invalid.");
        return;
    }
    
    const wpUrl = ENDPOINTS[env];
    const statusMessage = `Attempting to clear cache on ${env.toUpperCase()} environment...`;
    
    console.log(statusMessage);
    output.set('status', 'In Progress');
    output.set('details', statusMessage);

    try {
        // 1. Get authentication credentials
        const authSecret = await input.secret(SECRET_NAME);
        const authB64 = buildBasicAuth(authSecret, SECRET_NAME);

        // 2. Make the API call
        const response = await fetch(wpUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${authB64}`,
            },
            body: JSON.stringify({}),
        });

        const responseJson = await response.json();

        // 3. Handle the response, using output.set()
        if (response.ok && responseJson.success) {
            console.log('✅ Success!', responseJson.message);
            output.set('status', 'Success');
            output.set('details', responseJson.message);
        } else {
            const errorMessage = responseJson.message || `HTTP Error ${response.status}`;
            console.error('❌ Error!', errorMessage);
            output.set('status', 'Error');
            output.set('details', errorMessage);
        }

    } catch (err) {
        const error = err as Error;
        console.error('❌ Critical Error!', error.message);
        output.set('status', 'Critical Error');
        output.set('details', error.message);
    }
}

// Run the main function
main();