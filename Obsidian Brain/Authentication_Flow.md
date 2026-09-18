# Authentication Flow

Detailed flow of the [[Role_Based_Access]] system:
1. User enters plaintext in the [[Admin_Portal]].
2. Subtly encrypted via Web Crypto API.
3. Hash compared against `.env` variables.
