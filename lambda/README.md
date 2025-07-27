# AWS Lambda Functions

## SES Email Processor

This Lambda function processes incoming SES emails and forwards them to Cloudflare Workers.

### Prerequisites
- AWS CLI configured with appropriate permissions
- AWS SAM CLI installed
- SES domain verification and receipt rules configured

### Deployment
```bash
cd lambda/ses-email-processor
npm install
npm run build
sam deploy --guided
```

### Environment Variables
- `CLOUDFLARE_WORKER_URL`: URL of your Cloudflare Worker (e.g., https://api.0.email)
- `CLOUDFLARE_AUTH_TOKEN`: Authentication token for secure communication

### SES Configuration
After deployment, configure SES receipt rules to invoke this Lambda function for your custom domains.

### Architecture
1. SES receives emails for custom domains
2. SES invokes the Lambda function with email metadata
3. Lambda processes the email and extracts relevant information
4. Lambda forwards the processed data to the existing Cloudflare Workers SES webhook
5. Cloudflare Workers continue with the existing email processing pipeline

### Authentication
The Lambda function uses bearer token authentication when forwarding requests to Cloudflare Workers to ensure secure communication.
