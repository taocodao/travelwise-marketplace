# ECR Deployment Script for travelwise-mcp
# Run this script from the travelwise-marketplace directory

$AWS_ACCOUNT_ID = "856761731654"
$AWS_REGION = "us-east-1"
$ECR_REPO = "travelwise-mcp"
$IMAGE_TAG = "latest"

Write-Host "=== Step 1: Create ECR Repository (if not exists) ===" -ForegroundColor Cyan
aws ecr create-repository --repository-name $ECR_REPO --region $AWS_REGION 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "ECR repository created successfully" -ForegroundColor Green
} else {
    Write-Host "ECR repository already exists or error occurred" -ForegroundColor Yellow
}

Write-Host "`n=== Step 2: Login to ECR ===" -ForegroundColor Cyan
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

Write-Host "`n=== Step 3: Build Docker Image ===" -ForegroundColor Cyan
docker build -f Dockerfile.mcp -t "${ECR_REPO}:${IMAGE_TAG}" .

Write-Host "`n=== Step 4: Tag Image for ECR ===" -ForegroundColor Cyan
docker tag "${ECR_REPO}:${IMAGE_TAG}" "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}"

Write-Host "`n=== Step 5: Push to ECR ===" -ForegroundColor Cyan
docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}"

Write-Host "`n=== Done! ===" -ForegroundColor Green
Write-Host "Image pushed to: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}"
Write-Host "`nNext Steps:"
Write-Host "1. Go to AWS App Runner console"
Write-Host "2. Delete the current 'travelwise-mcp' service"
Write-Host "3. Create new service -> Select 'Container registry' -> Amazon ECR"
Write-Host "4. Select the image: $ECR_REPO:$IMAGE_TAG"
Write-Host "5. Set environment variables (DATABASE_URL, GEMINI_API_KEY, etc.)"
Write-Host "6. Set port to 3005"
