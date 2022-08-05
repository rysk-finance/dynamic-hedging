cd packages/contracts
npm install
echo "contracts installed"
npm run compile
echo "contracts compiled"
cd ../front-end
pwd
npm install --force
echo "front-end installed"
npm run build
echo "fe built sucessfully :)"
