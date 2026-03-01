/**
 * @file abi.ts
 * @description Contract ABIs for InkdToken, InkdVault, and InkdRegistry.
 */

export const INKD_TOKEN_ABI = [
  // ─── Read ─────────────────────────────────────────────────────────────
  { type: "function", name: "name", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
  { type: "function", name: "totalSupply", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "nextTokenId", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "mintPrice", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "MAX_SUPPLY", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "ownerOf", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "tokenURI", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "string" }], stateMutability: "view" },
  { type: "function", name: "mintedAt", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "inscriptionCount", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "isInkdHolder", inputs: [{ name: "wallet", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "getTokensByOwner", inputs: [{ name: "wallet", type: "address" }], outputs: [{ name: "tokenIds", type: "uint256[]" }], stateMutability: "view" },
  { type: "function", name: "royaltyInfo", inputs: [{ name: "tokenId", type: "uint256" }, { name: "salePrice", type: "uint256" }], outputs: [{ name: "receiver", type: "address" }, { name: "royaltyAmount", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getApproved", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { type: "function", name: "isApprovedForAll", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  // ─── Write ────────────────────────────────────────────────────────────
  { type: "function", name: "mint", inputs: [], outputs: [{ name: "tokenId", type: "uint256" }], stateMutability: "payable" },
  { type: "function", name: "batchMint", inputs: [{ name: "quantity", type: "uint256" }], outputs: [{ name: "tokenIds", type: "uint256[]" }], stateMutability: "payable" },
  { type: "function", name: "transferFrom", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "approve", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setApprovalForAll", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
  // ─── Events ───────────────────────────────────────────────────────────
  { type: "event", name: "TokenMinted", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "price", type: "uint256", indexed: false }] },
  { type: "event", name: "BatchMinted", inputs: [{ name: "tokenIds", type: "uint256[]", indexed: false }, { name: "owner", type: "address", indexed: true }, { name: "totalPrice", type: "uint256", indexed: false }] },
  { type: "event", name: "Transfer", inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: true }] },
] as const;

export const INKD_VAULT_ABI = [
  // ─── Read ─────────────────────────────────────────────────────────────
  { type: "function", name: "protocolFeeBps", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "protocolFeeBalance", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalInscriptions", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  {
    type: "function", name: "getInscriptions", inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "tuple[]", components: [
      { name: "arweaveHash", type: "string" }, { name: "contentType", type: "string" },
      { name: "size", type: "uint256" }, { name: "name", type: "string" },
      { name: "createdAt", type: "uint256" }, { name: "isRemoved", type: "bool" },
      { name: "version", type: "uint256" },
    ]}], stateMutability: "view",
  },
  {
    type: "function", name: "getInscription", inputs: [{ name: "tokenId", type: "uint256" }, { name: "inscriptionIndex", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: [
      { name: "arweaveHash", type: "string" }, { name: "contentType", type: "string" },
      { name: "size", type: "uint256" }, { name: "name", type: "string" },
      { name: "createdAt", type: "uint256" }, { name: "isRemoved", type: "bool" },
      { name: "version", type: "uint256" },
    ]}], stateMutability: "view",
  },
  { type: "function", name: "getInscriptionCount", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getVersionHistory", inputs: [{ name: "tokenId", type: "uint256" }, { name: "inscriptionIndex", type: "uint256" }], outputs: [{ name: "", type: "string[]" }], stateMutability: "view" },
  { type: "function", name: "hasAccess", inputs: [{ name: "tokenId", type: "uint256" }, { name: "wallet", type: "address" }], outputs: [{ name: "", type: "bool" }], stateMutability: "view" },
  {
    type: "function", name: "getActiveGrants",  inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "grants", type: "tuple[]", components: [
      { name: "grantee", type: "address" }, { name: "expiresAt", type: "uint256" }, { name: "grantedAt", type: "uint256" },
    ]}], stateMutability: "view",
  },
  // ─── Write ────────────────────────────────────────────────────────────
  {
    type: "function", name: "inscribe",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "arweaveHash", type: "string" }, { name: "contentType", type: "string" }, { name: "size", type: "uint256" }, { name: "name", type: "string" }],
    outputs: [{ name: "inscriptionIndex", type: "uint256" }], stateMutability: "payable",
  },
  { type: "function", name: "removeInscription", inputs: [{ name: "tokenId", type: "uint256" }, { name: "inscriptionIndex", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "updateInscription", inputs: [{ name: "tokenId", type: "uint256" }, { name: "inscriptionIndex", type: "uint256" }, { name: "newArweaveHash", type: "string" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "grantReadAccess", inputs: [{ name: "tokenId", type: "uint256" }, { name: "wallet", type: "address" }, { name: "expiresAt", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "revokeAccess", inputs: [{ name: "tokenId", type: "uint256" }, { name: "wallet", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  // ─── Events ───────────────────────────────────────────────────────────
  { type: "event", name: "Inscribed", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "inscriptionIndex", type: "uint256", indexed: true }, { name: "arweaveHash", type: "string", indexed: false }, { name: "contentType", type: "string", indexed: false }, { name: "size", type: "uint256", indexed: false }, { name: "name", type: "string", indexed: false }, { name: "protocolFee", type: "uint256", indexed: false }] },
  { type: "event", name: "InscriptionRemoved", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "inscriptionIndex", type: "uint256", indexed: true }] },
  { type: "event", name: "InscriptionUpdated", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "inscriptionIndex", type: "uint256", indexed: true }, { name: "newArweaveHash", type: "string", indexed: false }, { name: "newVersion", type: "uint256", indexed: false }] },
  { type: "event", name: "AccessGranted", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "grantee", type: "address", indexed: true }, { name: "expiresAt", type: "uint256", indexed: false }] },
  { type: "event", name: "AccessRevoked", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "grantee", type: "address", indexed: true }] },
] as const;

export const INKD_REGISTRY_ABI = [
  // ─── Read ─────────────────────────────────────────────────────────────
  { type: "function", name: "totalRegisteredTokens", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalTrackedInscriptions", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalVolume", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalSales", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "marketplaceFeeBps", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "registrations", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "tokenId", type: "uint256" }, { name: "owner", type: "address" }, { name: "isPublic", type: "bool" }, { name: "registeredAt", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "listings", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "tokenId", type: "uint256" }, { name: "seller", type: "address" }, { name: "price", type: "uint256" }, { name: "listedAt", type: "uint256" }, { name: "active", type: "bool" }], stateMutability: "view" },
  { type: "function", name: "searchByTag", inputs: [{ name: "tag", type: "string" }], outputs: [{ name: "tokenIds", type: "uint256[]" }], stateMutability: "view" },
  { type: "function", name: "searchByContentType", inputs: [{ name: "contentType", type: "string" }], outputs: [{ name: "tokenIds", type: "uint256[]" }], stateMutability: "view" },
  { type: "function", name: "searchByOwner", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "tokenIds", type: "uint256[]" }], stateMutability: "view" },
  { type: "function", name: "getPublicTokens", inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }], outputs: [{ name: "tokenIds", type: "uint256[]" }], stateMutability: "view" },
  {
    type: "function", name: "getActiveListings", inputs: [{ name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }],
    outputs: [{ name: "result", type: "tuple[]", components: [
      { name: "tokenId", type: "uint256" }, { name: "seller", type: "address" },
      { name: "price", type: "uint256" }, { name: "listedAt", type: "uint256" }, { name: "active", type: "bool" },
    ]}], stateMutability: "view",
  },
  { type: "function", name: "getInscriptionTags", inputs: [{ name: "tokenId", type: "uint256" }, { name: "inscriptionIndex", type: "uint256" }], outputs: [{ name: "", type: "string[]" }], stateMutability: "view" },
  { type: "function", name: "getStats", inputs: [], outputs: [{ name: "_totalTokens", type: "uint256" }, { name: "_totalInscriptions", type: "uint256" }, { name: "_totalVolume", type: "uint256" }, { name: "_totalSales", type: "uint256" }], stateMutability: "view" },
  // ─── Write ────────────────────────────────────────────────────────────
  { type: "function", name: "registerToken", inputs: [{ name: "tokenId", type: "uint256" }, { name: "isPublic", type: "bool" }, { name: "tags", type: "string[]" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "updateRegistration", inputs: [{ name: "tokenId", type: "uint256" }, { name: "isPublic", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "addTags", inputs: [{ name: "tokenId", type: "uint256" }, { name: "inscriptionIndex", type: "uint256" }, { name: "tags", type: "string[]" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "listForSale", inputs: [{ name: "tokenId", type: "uint256" }, { name: "price", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "cancelListing", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "buyToken", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [], stateMutability: "payable" },
  { type: "function", name: "indexContentType", inputs: [{ name: "tokenId", type: "uint256" }, { name: "contentType", type: "string" }], outputs: [], stateMutability: "nonpayable" },
  // ─── Events ───────────────────────────────────────────────────────────
  { type: "event", name: "TokenRegistered", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "isPublic", type: "bool", indexed: false }] },
  { type: "event", name: "TokenListed", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "price", type: "uint256", indexed: false }] },
  { type: "event", name: "TokenSold", inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "buyer", type: "address", indexed: true }, { name: "price", type: "uint256", indexed: false }, { name: "fee", type: "uint256", indexed: false }] },
] as const;
