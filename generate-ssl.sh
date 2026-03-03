#!/bin/bash
# Generate self-signed SSL certificate for testing

cd /root/.openclaw/workspace/hedge-fund

# Generate private key and certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=2a02:c207:2311:1618::1" \
    -addext "subjectAltName=IP:2a02:c207:2311:1618::1"

echo "SSL certificate generated:"
ls -la cert.pem key.pem
