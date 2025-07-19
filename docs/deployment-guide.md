# Deployment Guide

This guide provides detailed instructions for deploying the Quick-Share P2P platform to production environments. It covers both the frontend application and the signaling server deployment options.

## Deployment Architecture

The Quick-Share P2P platform consists of two main components that need to be deployed:

1. **Frontend Application**: A Next.js application that serves the user interface and handles P2P logic
2. **Signaling Server**: A Node.js Express server that facilitates WebRTC connections

```
┌─────────────────┐     ┌─────────────────┐
│  Load Balancer  │────►│  Frontend App   │
│  (Optional)     │     │  (Next.js)      │
└─────────────────┘     └─────────────────┘
        │                        │
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐
│  Signaling      │◄────┤  Redis          │
│  Server         │     │  (State)        │
└─────────────────┘     └─────────────────┘
```

## Deployment Options

### Option 1: Docker Deployment

#### Prerequisites

- Docker and Docker Compose installed
- Domain name with DNS configured
- SSL certificates (recommended for production)

#### Frontend Deployment

1. **Build the Docker image**:
   ```bash
   # In the project root
   docker build -t quick-share-frontend .
   ```

2. **Run the container**:
   ```bash
   docker run -p 3000:3000 \
     -e NEXT_PUBLIC_SIGNALING_URL=https://signaling.yourdomain.com \
     -e NEXT_PUBLIC_APP_URL=https://app.yourdomain.com \
     -e NEXTAUTH_URL=https://app.yourdomain.com \
     -e NEXTAUTH_SECRET=your-nextauth-secret \
     -e GOOGLE_CLIENT_ID=your-google-client-id \
     -e GOOGLE_CLIENT_SECRET=your-google-client-secret \
     -e JWT_SECRET=your-jwt-secret \
     quick-share-frontend
   ```

#### Signaling Server Deployment

1. **Build the Docker image**:
   ```bash
   # In the server directory
   cd server
   docker build -t quick-share-signaling .
   ```

2. **Run the container**:
   ```bash
   docker run -p 3001:3001 \
     -e PORT=3001 \
     -e NODE_ENV=production \
     -e CORS_ORIGIN=https://app.yourdomain.com \
     -e ROOM_CODE_LENGTH=6 \
     -e ROOM_EXPIRY_SECONDS=3600 \
     -e RATE_LIMIT_WINDOW_MS=60000 \
     -e RATE_LIMIT_MAX_REQUESTS=100 \
     -e REDIS_URL=redis://redis:6379 \
     quick-share-signaling
   ```

#### Docker Compose Setup

Create a `docker-compose.yml` file for easier deployment:

```yaml
version: '3'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SIGNALING_URL=https://signaling.yourdomain.com
      - NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
      - NEXTAUTH_URL=https://app.yourdomain.com
      - NEXTAUTH_SECRET=your-nextauth-secret
      - GOOGLE_CLIENT_ID=your-google-client-id
      - GOOGLE_CLIENT_SECRET=your-google-client-secret
      - JWT_SECRET=your-jwt-secret
    restart: unless-stopped

  signaling:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
      - CORS_ORIGIN=https://app.yourdomain.com
      - ROOM_CODE_LENGTH=6
      - ROOM_EXPIRY_SECONDS=3600
      - RATE_LIMIT_WINDOW_MS=60000
      - RATE_LIMIT_MAX_REQUESTS=100
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

Run with:
```bash
docker-compose up -d
```

### Option 2: Kubernetes Deployment

The project includes Kubernetes manifests in the `server/deploy/kubernetes` directory.

#### Prerequisites

- Kubernetes cluster
- kubectl configured
- Helm (optional, for Redis deployment)

#### Deployment Steps

1. **Create the namespace**:
   ```bash
   kubectl apply -f server/deploy/kubernetes/namespace.yaml
   ```

2. **Deploy Redis** (if not already available):
   ```bash
   helm repo add bitnami https://charts.bitnami.com/bitnami
   helm install redis bitnami/redis --namespace quick-share
   ```

3. **Create ConfigMap and Secret**:
   ```bash
   kubectl apply -f server/deploy/kubernetes/configmap.yaml
   kubectl apply -f server/deploy/kubernetes/secret.yaml
   ```

   > **Note**: Update these files with your actual configuration values before applying.

4. **Deploy the signaling server**:
   ```bash
   kubectl apply -f server/deploy/kubernetes/deployment.yaml
   kubectl apply -f server/deploy/kubernetes/service.yaml
   ```

5. **Deploy the frontend** (create frontend deployment files based on the signaling server examples):
   ```bash
   kubectl apply -f deploy/kubernetes/frontend-deployment.yaml
   kubectl apply -f deploy/kubernetes/frontend-service.yaml
   ```

6. **Configure Ingress**:
   ```bash
   kubectl apply -f server/deploy/kubernetes/ingress.yaml
   ```

   > **Note**: Update the ingress.yaml with your domain names and TLS configuration.

### Option 3: Cloud Platform Deployment

#### Vercel (Frontend)

The Next.js frontend can be easily deployed to Vercel:

1. **Connect your GitHub repository** to Vercel
2. **Configure environment variables** in the Vercel dashboard
3. **Deploy** the application

#### Heroku (Signaling Server)

1. **Create a new Heroku app**:
   ```bash
   heroku create quick-share-signaling
   ```

2. **Add Redis add-on**:
   ```bash
   heroku addons:create heroku-redis:hobby-dev
   ```

3. **Configure environment variables**:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set CORS_ORIGIN=https://your-frontend-url.vercel.app
   heroku config:set ROOM_CODE_LENGTH=6
   heroku config:set ROOM_EXPIRY_SECONDS=3600
   heroku config:set RATE_LIMIT_WINDOW_MS=60000
   heroku config:set RATE_LIMIT_MAX_REQUESTS=100
   ```

4. **Deploy the server**:
   ```bash
   git subtree push --prefix server heroku main
   ```

## Monitoring and Logging

### Prometheus and Grafana Setup

The signaling server includes Prometheus metrics endpoints. To set up monitoring:

1. **Deploy Prometheus**:
   ```bash
   kubectl apply -f server/deploy/monitoring/prometheus.yml
   ```

2. **Deploy Grafana**:
   ```bash
   kubectl apply -f server/deploy/monitoring/grafana-datasource.yml
   kubectl apply -f server/deploy/monitoring/grafana-dashboard.json
   ```

### Logging Configuration

The signaling server uses Winston for logging. Configure log levels using environment variables:

```
LOG_LEVEL=info
LOG_FORMAT=json
```

For production, it's recommended to use a centralized logging solution like ELK Stack or Datadog.

## SSL/TLS Configuration

For production deployments, SSL/TLS is essential:

1. **Obtain SSL certificates** from Let's Encrypt or another provider
2. **Configure your ingress controller** or reverse proxy with the certificates
3. **Ensure WebSocket connections** use WSS (secure WebSockets)

## Security Considerations

1. **Rate Limiting**: Configure appropriate rate limits to prevent abuse
2. **CORS Settings**: Restrict CORS to only your frontend domain
3. **Security Headers**: Ensure proper security headers are set
4. **Redis Security**: Secure Redis with authentication and network isolation
5. **Regular Updates**: Keep all dependencies updated to patch security vulnerabilities

## Scaling Considerations

### Frontend Scaling

The Next.js frontend is stateless and can be horizontally scaled without special configuration.

### Signaling Server Scaling

The signaling server can be scaled horizontally with these considerations:

1. **Shared Redis**: Ensure all instances connect to the same Redis instance
2. **Sticky Sessions**: Configure load balancers to use sticky sessions for WebSocket connections
3. **Resource Allocation**: Monitor CPU and memory usage to determine optimal instance sizes

## Backup and Disaster Recovery

1. **Redis Persistence**: Configure Redis with appropriate persistence settings
2. **Regular Backups**: Schedule regular backups of Redis data
3. **Multi-Region Deployment**: For high availability, deploy to multiple regions

## Troubleshooting Production Issues

### Common Production Issues

1. **WebSocket Connection Failures**:
   - Check network ACLs and firewall rules
   - Verify SSL/TLS configuration
   - Ensure load balancers support WebSocket connections

2. **High Memory Usage**:
   - Monitor Redis memory usage
   - Check for memory leaks in the Node.js application
   - Adjust container resource limits

3. **Rate Limiting Too Aggressive**:
   - Adjust rate limiting parameters based on actual usage patterns
   - Monitor rate limiting metrics to find the right balance

## Maintenance Procedures

### Updating the Application

1. **Frontend Updates**:
   ```bash
   # Pull latest changes
   git pull
   # Build new image
   docker build -t quick-share-frontend:new .
   # Update the deployment
   kubectl set image deployment/frontend frontend=quick-share-frontend:new
   ```

2. **Signaling Server Updates**:
   ```bash
   # Pull latest changes
   git pull
   # Build new image
   docker build -t quick-share-signaling:new ./server
   # Update the deployment
   kubectl set image deployment/signaling-server signaling-server=quick-share-signaling:new
   ```

### Database Migrations

If you add database features beyond Redis:

1. **Create migration scripts** in the server/src/database/migrations directory
2. **Run migrations** before deploying new server versions
3. **Backup data** before running migrations

## Performance Optimization

1. **CDN Integration**: Use a CDN for static assets
2. **Redis Optimization**: Monitor and tune Redis performance
3. **Load Testing**: Regularly perform load tests to identify bottlenecks

## Compliance and Privacy

Ensure your deployment complies with relevant regulations:

1. **Data Privacy**: Implement appropriate data handling practices
2. **Terms of Service**: Create clear terms of service
3. **Cookie Compliance**: Implement cookie consent if using cookies
4. **Accessibility**: Ensure the application meets accessibility standards

## Conclusion

This deployment guide covers the essential aspects of deploying the Quick-Share P2P platform to production. For specific questions or issues, please refer to the project's issue tracker or contact the maintainers.