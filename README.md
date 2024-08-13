# 🎯 Donor Fund Tracking and Management System

## 📄 Definition
This system is designed to streamline the process of managing donations for charitable organizations. It provides a comprehensive platform where donor and charity profiles can be created, managed, and tracked efficiently. The system enables charities to run campaigns, accept donations, and generate reports on donation activities. Donors can create profiles, track their donation history, and participate in various charity campaigns.

## 🚀 Features

### 👤 Donor Profile Management
- 📝 **Create and manage** donor profiles with personal details, contact information, and donation history.
- ✏️ **Update** existing donor profiles with new information or modify existing data.
- 🔍 **View** donor profiles by ID or owner, and retrieve all profiles in the system.
- 🗑️ **Delete** donor profiles when no longer needed.

### 🏢 Charity Profile Management
- 📝 **Create and manage** charity profiles with essential information such as mission statements, contact details, and donation records.
- ✏️ **Update** existing charity profiles and track the total amount received by the charity.
- 🔍 **Retrieve** charity profiles by ID or owner, and list all charity profiles within the system.
- 🗑️ **Delete** charity profiles if required.

### 🎁 Campaign Management
- 📝 **Create and manage** fundraising campaigns, including setting target amounts, descriptions, and associated charities.
- ✏️ **Update** campaign details and track contributions from donors.
- 🔍 **View** campaign details by ID and retrieve all campaigns in the system.
- 🗑️ **Delete** campaigns that are no longer active or necessary.

### 💰 Donation Management
- 💳 **Reserve donations** with validation to ensure that all required fields are provided and donors, charities, and campaigns exist.
- ✅ **Complete** reserved donations by verifying payments and updating donation records.
- 🔍 **View** all donations, as well as donations specific to a donor or charity.

### 📊 Donation Report Management
- 📝 **Create** detailed donation reports, including information on donors, charities, campaigns, and the status of donations.
- 🔍 **Retrieve** all donation reports to provide comprehensive insights into donation activities.

### 🏅 Campaign Status Tracking
- ⏳ **Track** the status of campaigns, including pending, accepted, completed, and cancelled campaigns.
- 🏁 **Mark campaigns as completed** when fundraising goals are achieved or the campaign period ends.
- 🔍 **Retrieve** all accepted or completed campaigns for monitoring and analysis.



## Things to be explained in the course:
1. What is Ledger? More details here: https://internetcomputer.org/docs/current/developer-docs/integrations/ledger/
2. What is Internet Identity? More details here: https://internetcomputer.org/internet-identity
3. What is Principal, Identity, Address? https://internetcomputer.org/internet-identity | https://yumimarketplace.medium.com/whats-the-difference-between-principal-id-and-account-id-3c908afdc1f9
4. Canister-to-canister communication and how multi-canister development is done? https://medium.com/icp-league/explore-backend-multi-canister-development-on-ic-680064b06320

## How to deploy canisters implemented in the course

### Ledger canister
`./deploy-local-ledger.sh` - deploys a local Ledger canister. IC works differently when run locally so there is no default network token available and you have to deploy it yourself. Remember that it's not a token like ERC-20 in Ethereum, it's a native token for ICP, just deployed separately.
This canister is described in the `dfx.json`:
```
	"ledger_canister": {
  	"type": "custom",
  	"candid": "https://raw.githubusercontent.com/dfinity/ic/928caf66c35627efe407006230beee60ad38f090/rs/rosetta-api/icp_ledger/ledger.did",
  	"wasm": "https://download.dfinity.systems/ic/928caf66c35627efe407006230beee60ad38f090/canisters/ledger-canister.wasm.gz",
  	"remote": {
    	"id": {
      	"ic": "ryjl3-tyaaa-aaaaa-aaaba-cai"
    	}
  	}
	}
```
`remote.id.ic` - that is the principal of the Ledger canister and it will be available by this principal when you work with the ledger.

Also, in the scope of this script, a minter identity is created which can be used for minting tokens
for the testing purposes.
Additionally, the default identity is pre-populated with 1000_000_000_000 e8s which is equal to 10_000 * 10**8 ICP.
The decimals value for ICP is 10**8.

List identities:
`dfx identity list`

Switch to the minter identity:
`dfx identity use minter`

Transfer ICP:
`dfx ledger transfer <ADDRESS>  --memo 0 --icp 100 --fee 0`
where:
 - `--memo` is some correlation id that can be set to identify some particular transactions (we use that in the marketplace canister).
 - `--icp` is the transfer amount
 - `--fee` is the transaction fee. In this case it's 0 because we make this transfer as the minter idenity thus this transaction is of type MINT, not TRANSFER.
 - `<ADDRESS>` is the address of the recipient. To get the address from the principal, you can use the helper function from the marketplace canister - `getAddressFromPrincipal(principal: Principal)`, it can be called via the Candid UI.


### Internet identity canister

`dfx deploy internet_identity` - that is the canister that handles the authentication flow. Once it's deployed, the `js-agent` library will be talking to it to register identities. There is UI that acts as a wallet where you can select existing identities
or create a new one.

### Marketplace canister

`dfx deploy dfinity_js_backend` - deploys the marketplace canister where the business logic is implemented.
Basically, it implements functions like add, view, update, delete, and buy products + a set of helper functions.

Do not forget to run `dfx generate dfinity_js_backend` anytime you add/remove functions in the canister or when you change the signatures.
Otherwise, these changes won't be reflected in IDL's and won't work when called using the JS agent.

