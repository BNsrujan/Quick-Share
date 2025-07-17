# Quick-share

## **Why Are We Building This?**

Traditional file-sharing methods have major drawbacks:

- **Slow Transfers**: Large files take too much time to send.
- **Quality Loss**: Platforms like WhatsApp reduce image quality.
- **Security Risks**: Centralized services store and analyze data, compromising privacy.
- **Limited Accessibility**: Some platforms require logins, apps, or cloud storage.

**Solution:**

fileshare.io enables fast, secure, and direct P2P file transfers without a middleman, ensuring speed, privacy, and ease of use.

## **Key Features**

- **P2P File Sharing**: Direct device-to-device transfer with no middle server.
- **End-to-End Encryption**: Secure file transfers with robust encryption.
- **10x Faster Transfer Speeds**: Uses **parallel transfers & full network bandwidth**.
- **Pause & Resume Transfers**: Handles network issues seamlessly.
- **Offline Sharing**: Share files using a unique **one-time code**.
- **Web-Based Access**: No app required, just a simple **URL** to start sharing.

## **How It Works**

1. **User Uploads a File in route/page**
2. **people how are in that page can download the file with a cade**
3. **Direct P2P Transfer Ensures Speed & Privacy**

## **Technical Implementation**

### **Data Transmission & Storage**

- **WebRTC** – Direct P2P connections.
- **gRPC (Protocol Buffers)** – Optimized for low-latency file transfers.

### **Performance & Security Enhancements**

- **File Chunking & Parallel Transfers** – Splitting data into smaller parts for faster delivery.
- **Full Bandwidth Utilization** – Maximizing available network speed.
- **Port Management** – Securely allowing necessary connections.
- **MAC Address Validation** – Preventing unauthorized access.
- **End-to-End Encryption** – Ensuring data privacy during transmission.
- **Load Balancer & Elastic Servers** – Scaling with demand for stability.

## **User Actions**

- **Upload & Share** – Select files and generate a shareable link or code.
- **Receive & Download** – Enter the link or code to get the file.
- **Pause/Resume Transfers** – Control file sharing even with network issues.
- **Sign In (Optional)** – Use Google authentication for added features.

# Test Subjects 
   -  2 pdfs - 14.3mb 
   -  one photo - 2.01mb

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.