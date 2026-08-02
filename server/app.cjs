// Dynamic import for ES Module support in Phusion Passenger / cPanel NodeJS Selector
import('./src/index.js').catch(err => {
    console.error('Failed to start application via app.cjs wrapper:', err);
});
