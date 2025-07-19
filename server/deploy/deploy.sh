#!/bin/bash

# Exit on error
set -e

# Configuration
NAMESPACE="quick-share"
APP_NAME="signaling-server"
IMAGE_NAME="quick-share-p2p-signaling-server"
IMAGE_TAG=${1:-"latest"}  # Use provided tag or default to latest

# Print configuration
echo "Deploying $APP_NAME with image $IMAGE_NAME:$IMAGE_TAG to namespace $NAMESPACE"

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "kubectl is not installed. Please install kubectl first."
    exit 1
fi

# Check if namespace exists, create if not
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    echo "Creating namespace $NAMESPACE"
    kubectl apply -f kubernetes/namespace.yaml
fi

# Apply Kubernetes configurations
echo "Applying Kubernetes configurations..."
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secret.yaml
kubectl apply -f kubernetes/service.yaml
kubectl apply -f kubernetes/ingress.yaml

# Update deployment with new image
echo "Updating deployment with image $IMAGE_NAME:$IMAGE_TAG"
kubectl set image deployment/$APP_NAME -n $NAMESPACE $APP_NAME=$IMAGE_NAME:$IMAGE_TAG

# Wait for rollout to complete
echo "Waiting for rollout to complete..."
kubectl rollout status deployment/$APP_NAME -n $NAMESPACE --timeout=300s

# Verify deployment
echo "Verifying deployment..."
kubectl get pods -n $NAMESPACE -l app=$APP_NAME

echo "Deployment completed successfully!"