#!/usr/bin/env bash
 
 dfx stop && dfx start --background --clean
 ./deploy-local-ledger.sh
 dfx deploy internet_identity
 dfx deploy dfinity_js_backend && dfx generate  dfinity_js_backend
 dfx deploy dfinity_js_frontend 