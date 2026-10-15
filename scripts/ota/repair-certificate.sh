#!/bin/sh
set -eu
base=/srv/apps/logic-coin/shared/ota/keys
target="$base/certificate-code-signing-20261009.pem"
test ! -e "$target"
openssl req -x509 -new -key "$base/private.pem" -out "$target" -days 3650 -subj '/CN=Logic Coin Updates' -addext 'keyUsage=critical,digitalSignature' -addext 'extendedKeyUsage=codeSigning'
openssl verify -CAfile "$target" -purpose any "$target"
openssl x509 -in "$target" -noout -text | grep -A1 'Extended Key Usage' | grep 'Code Signing'
openssl x509 -in "$target" -pubkey -noout > /tmp/logic-new-public-key.pem
openssl x509 -in "$base/certificate.pem" -pubkey -noout > /tmp/logic-old-public-key.pem
cmp /tmp/logic-new-public-key.pem /tmp/logic-old-public-key.pem
cp -n "$base/certificate.pem" "$base/certificate-before-code-signing-20261009.pem"
cp "$target" "$base/certificate.pem"
echo 'Code Signing certificate repaired; original public key preserved.'
