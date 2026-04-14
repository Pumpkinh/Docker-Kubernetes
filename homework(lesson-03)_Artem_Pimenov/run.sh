#!/bin/bash

set -e

echo "=============================="
echo "  Select animation to build"
echo "=============================="
echo "1) Galaxy"
echo "2) Particles"
echo "3) Solar System"
echo "4) Cyberpunk Grid"
echo "5) Black Hole"
echo "6) Starfield Warp"
echo "=============================="

read -p "Enter choice [1-6]: " choice

case $choice in
  1)
    FILE="main1.js"
    NAME="galaxy"
    ;;
  2)
    FILE="main2.js"
    NAME="particles"
    ;;
  3)
    FILE="main3.js"
    NAME="solar"
    ;;
  4)
    FILE="main4.js"
    NAME="cyberpunk"
    ;;
  5)
    FILE="main5.js"
    NAME="blackhole"
    ;;
  6)
    FILE="main6.js"
    NAME="warp"
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

IMAGE_NAME="three-demo:${NAME}"

echo ""
echo "👉 Building image with ${FILE}..."
echo "👉 Image name: ${IMAGE_NAME}"
echo ""

docker build --no-cache \
  --build-arg MAIN_FILE=${FILE} \
  -t ${IMAGE_NAME} .

echo ""
echo "✅ Build completed!"
echo ""
echo "To run:"
echo "docker run -p 8080:8080 ${IMAGE_NAME}"

