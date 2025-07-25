#!/bin/bash

# セルフサイン証明書の作成スクリプト
# macOS Gatekeeper警告を軽減するため

echo "Creating self-signed certificate for Score at Once..."

# 証明書の作成
security create-keypair \
  -a "Score at Once Developer" \
  -d "Score at Once Developer" \
  -c "Score at Once Developer" \
  -t 1 \
  -f 18 \
  -s 512 \
  -S "/CN=Score at Once Developer" \
  -K "/tmp/score-at-once-cert.keychain" \
  -P ""

# キーチェーンに追加
security import "/tmp/score-at-once-cert.keychain" -k ~/Library/Keychains/login.keychain-db

echo "Self-signed certificate created successfully!"
echo "Certificate name: Score at Once Developer"