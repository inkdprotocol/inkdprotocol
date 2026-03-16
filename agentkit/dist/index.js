"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../node_modules/@x402/core/dist/esm/chunk-VE37GDG2.mjs
var x402Version;
var init_chunk_VE37GDG2 = __esm({
  "../node_modules/@x402/core/dist/esm/chunk-VE37GDG2.mjs"() {
    "use strict";
    x402Version = 2;
  }
});

// ../node_modules/@x402/core/dist/esm/chunk-HRQUGJ3Y.mjs
var init_chunk_HRQUGJ3Y = __esm({
  "../node_modules/@x402/core/dist/esm/chunk-HRQUGJ3Y.mjs"() {
    "use strict";
  }
});

// ../node_modules/@x402/core/dist/esm/chunk-TDLQZ6MP.mjs
function safeBase64Encode(data) {
  if (typeof globalThis !== "undefined" && typeof globalThis.btoa === "function") {
    const bytes = new TextEncoder().encode(data);
    const binaryString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return globalThis.btoa(binaryString);
  }
  return Buffer.from(data, "utf8").toString("base64");
}
function safeBase64Decode(data) {
  if (typeof globalThis !== "undefined" && typeof globalThis.atob === "function") {
    const binaryString = globalThis.atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes);
  }
  return Buffer.from(data, "base64").toString("utf-8");
}
var findSchemesByNetwork, findByNetworkAndScheme, Base64EncodedRegex;
var init_chunk_TDLQZ6MP = __esm({
  "../node_modules/@x402/core/dist/esm/chunk-TDLQZ6MP.mjs"() {
    "use strict";
    findSchemesByNetwork = (map, network) => {
      let implementationsByScheme = map.get(network);
      if (!implementationsByScheme) {
        for (const [registeredNetworkPattern, implementations] of map.entries()) {
          const pattern = registeredNetworkPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
          const regex = new RegExp(`^${pattern}$`);
          if (regex.test(network)) {
            implementationsByScheme = implementations;
            break;
          }
        }
      }
      return implementationsByScheme;
    };
    findByNetworkAndScheme = (map, scheme, network) => {
      return findSchemesByNetwork(map, network)?.get(scheme);
    };
    Base64EncodedRegex = /^[A-Za-z0-9+/]*={0,2}$/;
  }
});

// ../node_modules/@x402/core/dist/esm/chunk-BJTO5JO5.mjs
var init_chunk_BJTO5JO5 = __esm({
  "../node_modules/@x402/core/dist/esm/chunk-BJTO5JO5.mjs"() {
    "use strict";
  }
});

// ../node_modules/@x402/core/dist/esm/chunk-CM4FD6HG.mjs
function encodePaymentSignatureHeader(paymentPayload) {
  return safeBase64Encode(JSON.stringify(paymentPayload));
}
function decodePaymentRequiredHeader(paymentRequiredHeader) {
  if (!Base64EncodedRegex.test(paymentRequiredHeader)) {
    throw new Error("Invalid payment required header");
  }
  return JSON.parse(safeBase64Decode(paymentRequiredHeader));
}
function decodePaymentResponseHeader(paymentResponseHeader) {
  if (!Base64EncodedRegex.test(paymentResponseHeader)) {
    throw new Error("Invalid payment response header");
  }
  return JSON.parse(safeBase64Decode(paymentResponseHeader));
}
var x402HTTPClient;
var init_chunk_CM4FD6HG = __esm({
  "../node_modules/@x402/core/dist/esm/chunk-CM4FD6HG.mjs"() {
    "use strict";
    init_chunk_VE37GDG2();
    init_chunk_HRQUGJ3Y();
    init_chunk_TDLQZ6MP();
    init_chunk_BJTO5JO5();
    x402HTTPClient = class {
      /**
       * Creates a new x402HTTPClient instance.
       *
       * @param client - The underlying x402Client for payment logic
       */
      constructor(client) {
        this.client = client;
        this.paymentRequiredHooks = [];
      }
      /**
       * Register a hook to handle 402 responses before payment.
       * Hooks run in order; first to return headers wins.
       *
       * @param hook - The hook function to register
       * @returns This instance for chaining
       */
      onPaymentRequired(hook) {
        this.paymentRequiredHooks.push(hook);
        return this;
      }
      /**
       * Run hooks and return headers if any hook provides them.
       *
       * @param paymentRequired - The payment required response from the server
       * @returns Headers to use for retry, or null to proceed to payment
       */
      async handlePaymentRequired(paymentRequired) {
        for (const hook of this.paymentRequiredHooks) {
          const result = await hook({ paymentRequired });
          if (result?.headers) {
            return result.headers;
          }
        }
        return null;
      }
      /**
       * Encodes a payment payload into appropriate HTTP headers based on version.
       *
       * @param paymentPayload - The payment payload to encode
       * @returns HTTP headers containing the encoded payment signature
       */
      encodePaymentSignatureHeader(paymentPayload) {
        switch (paymentPayload.x402Version) {
          case 2:
            return {
              "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(paymentPayload)
            };
          case 1:
            return {
              "X-PAYMENT": encodePaymentSignatureHeader(paymentPayload)
            };
          default:
            throw new Error(
              `Unsupported x402 version: ${paymentPayload.x402Version}`
            );
        }
      }
      /**
       * Extracts payment required information from HTTP response.
       *
       * @param getHeader - Function to retrieve header value by name (case-insensitive)
       * @param body - Optional response body for v1 compatibility
       * @returns The payment required object
       */
      getPaymentRequiredResponse(getHeader, body) {
        const paymentRequired = getHeader("PAYMENT-REQUIRED");
        if (paymentRequired) {
          return decodePaymentRequiredHeader(paymentRequired);
        }
        if (body && body instanceof Object && "x402Version" in body && body.x402Version === 1) {
          return body;
        }
        throw new Error("Invalid payment required response");
      }
      /**
       * Extracts payment settlement response from HTTP headers.
       *
       * @param getHeader - Function to retrieve header value by name (case-insensitive)
       * @returns The settlement response object
       */
      getPaymentSettleResponse(getHeader) {
        const paymentResponse = getHeader("PAYMENT-RESPONSE");
        if (paymentResponse) {
          return decodePaymentResponseHeader(paymentResponse);
        }
        const xPaymentResponse = getHeader("X-PAYMENT-RESPONSE");
        if (xPaymentResponse) {
          return decodePaymentResponseHeader(xPaymentResponse);
        }
        throw new Error("Payment response header not found");
      }
      /**
       * Creates a payment payload for the given payment requirements.
       * Delegates to the underlying x402Client.
       *
       * @param paymentRequired - The payment required response from the server
       * @returns Promise resolving to the payment payload
       */
      async createPaymentPayload(paymentRequired) {
        return this.client.createPaymentPayload(paymentRequired);
      }
    };
  }
});

// ../node_modules/@x402/core/dist/esm/client/index.mjs
var x402Client;
var init_client = __esm({
  "../node_modules/@x402/core/dist/esm/client/index.mjs"() {
    "use strict";
    init_chunk_CM4FD6HG();
    init_chunk_VE37GDG2();
    init_chunk_HRQUGJ3Y();
    init_chunk_TDLQZ6MP();
    init_chunk_BJTO5JO5();
    x402Client = class _x402Client {
      /**
       * Creates a new x402Client instance.
       *
       * @param paymentRequirementsSelector - Function to select payment requirements from available options
       */
      constructor(paymentRequirementsSelector) {
        this.registeredClientSchemes = /* @__PURE__ */ new Map();
        this.policies = [];
        this.registeredExtensions = /* @__PURE__ */ new Map();
        this.beforePaymentCreationHooks = [];
        this.afterPaymentCreationHooks = [];
        this.onPaymentCreationFailureHooks = [];
        this.paymentRequirementsSelector = paymentRequirementsSelector || ((x402Version2, accepts) => accepts[0]);
      }
      /**
       * Creates a new x402Client instance from a configuration object.
       *
       * @param config - The client configuration including schemes, policies, and payment requirements selector
       * @returns A configured x402Client instance
       */
      static fromConfig(config) {
        const client = new _x402Client(config.paymentRequirementsSelector);
        config.schemes.forEach((scheme) => {
          if (scheme.x402Version === 1) {
            client.registerV1(scheme.network, scheme.client);
          } else {
            client.register(scheme.network, scheme.client);
          }
        });
        config.policies?.forEach((policy) => {
          client.registerPolicy(policy);
        });
        return client;
      }
      /**
       * Registers a scheme client for the current x402 version.
       *
       * @param network - The network to register the client for
       * @param client - The scheme network client to register
       * @returns The x402Client instance for chaining
       */
      register(network, client) {
        return this._registerScheme(x402Version, network, client);
      }
      /**
       * Registers a scheme client for x402 version 1.
       *
       * @param network - The v1 network identifier (e.g., 'base-sepolia', 'solana-devnet')
       * @param client - The scheme network client to register
       * @returns The x402Client instance for chaining
       */
      registerV1(network, client) {
        return this._registerScheme(1, network, client);
      }
      /**
       * Registers a policy to filter or transform payment requirements.
       *
       * Policies are applied in order after filtering by registered schemes
       * and before the selector chooses the final payment requirement.
       *
       * @param policy - Function to filter/transform payment requirements
       * @returns The x402Client instance for chaining
       *
       * @example
       * ```typescript
       * // Prefer cheaper options
       * client.registerPolicy((version, reqs) =>
       *   reqs.filter(r => BigInt(r.value) < BigInt('1000000'))
       * );
       *
       * // Prefer specific networks
       * client.registerPolicy((version, reqs) =>
       *   reqs.filter(r => r.network.startsWith('eip155:'))
       * );
       * ```
       */
      registerPolicy(policy) {
        this.policies.push(policy);
        return this;
      }
      /**
       * Registers a client extension that can enrich payment payloads.
       *
       * Extensions are invoked after the scheme creates the base payload and the
       * payload is wrapped with extensions/resource/accepted data. If the extension's
       * key is present in `paymentRequired.extensions`, the extension's
       * `enrichPaymentPayload` hook is called to modify the payload.
       *
       * @param extension - The client extension to register
       * @returns The x402Client instance for chaining
       */
      registerExtension(extension) {
        this.registeredExtensions.set(extension.key, extension);
        return this;
      }
      /**
       * Register a hook to execute before payment payload creation.
       * Can abort creation by returning { abort: true, reason: string }
       *
       * @param hook - The hook function to register
       * @returns The x402Client instance for chaining
       */
      onBeforePaymentCreation(hook) {
        this.beforePaymentCreationHooks.push(hook);
        return this;
      }
      /**
       * Register a hook to execute after successful payment payload creation.
       *
       * @param hook - The hook function to register
       * @returns The x402Client instance for chaining
       */
      onAfterPaymentCreation(hook) {
        this.afterPaymentCreationHooks.push(hook);
        return this;
      }
      /**
       * Register a hook to execute when payment payload creation fails.
       * Can recover from failure by returning { recovered: true, payload: PaymentPayload }
       *
       * @param hook - The hook function to register
       * @returns The x402Client instance for chaining
       */
      onPaymentCreationFailure(hook) {
        this.onPaymentCreationFailureHooks.push(hook);
        return this;
      }
      /**
       * Creates a payment payload based on a PaymentRequired response.
       *
       * Automatically extracts x402Version, resource, and extensions from the PaymentRequired
       * response and constructs a complete PaymentPayload with the accepted requirements.
       *
       * @param paymentRequired - The PaymentRequired response from the server
       * @returns Promise resolving to the complete payment payload
       */
      async createPaymentPayload(paymentRequired) {
        const clientSchemesByNetwork = this.registeredClientSchemes.get(paymentRequired.x402Version);
        if (!clientSchemesByNetwork) {
          throw new Error(`No client registered for x402 version: ${paymentRequired.x402Version}`);
        }
        const requirements = this.selectPaymentRequirements(paymentRequired.x402Version, paymentRequired.accepts);
        const context = {
          paymentRequired,
          selectedRequirements: requirements
        };
        for (const hook of this.beforePaymentCreationHooks) {
          const result = await hook(context);
          if (result && "abort" in result && result.abort) {
            throw new Error(`Payment creation aborted: ${result.reason}`);
          }
        }
        try {
          const schemeNetworkClient = findByNetworkAndScheme(clientSchemesByNetwork, requirements.scheme, requirements.network);
          if (!schemeNetworkClient) {
            throw new Error(`No client registered for scheme: ${requirements.scheme} and network: ${requirements.network}`);
          }
          const partialPayload = await schemeNetworkClient.createPaymentPayload(
            paymentRequired.x402Version,
            requirements,
            { extensions: paymentRequired.extensions }
          );
          let paymentPayload;
          if (partialPayload.x402Version == 1) {
            paymentPayload = partialPayload;
          } else {
            const mergedExtensions = this.mergeExtensions(
              paymentRequired.extensions,
              partialPayload.extensions
            );
            paymentPayload = {
              x402Version: partialPayload.x402Version,
              payload: partialPayload.payload,
              extensions: mergedExtensions,
              resource: paymentRequired.resource,
              accepted: requirements
            };
          }
          paymentPayload = await this.enrichPaymentPayloadWithExtensions(paymentPayload, paymentRequired);
          const createdContext = {
            ...context,
            paymentPayload
          };
          for (const hook of this.afterPaymentCreationHooks) {
            await hook(createdContext);
          }
          return paymentPayload;
        } catch (error) {
          const failureContext = {
            ...context,
            error
          };
          for (const hook of this.onPaymentCreationFailureHooks) {
            const result = await hook(failureContext);
            if (result && "recovered" in result && result.recovered) {
              return result.payload;
            }
          }
          throw error;
        }
      }
      /**
       * Merges server-declared extensions with scheme-provided extensions.
       * Scheme extensions overlay on top of server extensions at each key,
       * preserving server-provided schema while overlaying scheme-provided info.
       *
       * @param serverExtensions - Extensions declared by the server in the 402 response
       * @param schemeExtensions - Extensions provided by the scheme client (e.g. EIP-2612)
       * @returns The merged extensions object, or undefined if both inputs are undefined
       */
      mergeExtensions(serverExtensions, schemeExtensions) {
        if (!schemeExtensions) return serverExtensions;
        if (!serverExtensions) return schemeExtensions;
        const merged = { ...serverExtensions };
        for (const [key, schemeValue] of Object.entries(schemeExtensions)) {
          const serverValue = merged[key];
          if (serverValue && typeof serverValue === "object" && schemeValue && typeof schemeValue === "object") {
            merged[key] = { ...serverValue, ...schemeValue };
          } else {
            merged[key] = schemeValue;
          }
        }
        return merged;
      }
      /**
       * Enriches a payment payload by calling registered extension hooks.
       * For each extension key present in the PaymentRequired response,
       * invokes the corresponding extension's enrichPaymentPayload callback.
       *
       * @param paymentPayload - The payment payload to enrich with extension data
       * @param paymentRequired - The PaymentRequired response containing extension declarations
       * @returns The enriched payment payload with extension data applied
       */
      async enrichPaymentPayloadWithExtensions(paymentPayload, paymentRequired) {
        if (!paymentRequired.extensions || this.registeredExtensions.size === 0) {
          return paymentPayload;
        }
        let enriched = paymentPayload;
        for (const [key, extension] of this.registeredExtensions) {
          if (key in paymentRequired.extensions && extension.enrichPaymentPayload) {
            enriched = await extension.enrichPaymentPayload(enriched, paymentRequired);
          }
        }
        return enriched;
      }
      /**
       * Selects appropriate payment requirements based on registered clients and policies.
       *
       * Selection process:
       * 1. Filter by registered schemes (network + scheme support)
       * 2. Apply all registered policies in order
       * 3. Use selector to choose final requirement
       *
       * @param x402Version - The x402 protocol version
       * @param paymentRequirements - Array of available payment requirements
       * @returns The selected payment requirements
       */
      selectPaymentRequirements(x402Version2, paymentRequirements) {
        const clientSchemesByNetwork = this.registeredClientSchemes.get(x402Version2);
        if (!clientSchemesByNetwork) {
          throw new Error(`No client registered for x402 version: ${x402Version2}`);
        }
        const supportedPaymentRequirements = paymentRequirements.filter((requirement) => {
          let clientSchemes = findSchemesByNetwork(clientSchemesByNetwork, requirement.network);
          if (!clientSchemes) {
            return false;
          }
          return clientSchemes.has(requirement.scheme);
        });
        if (supportedPaymentRequirements.length === 0) {
          throw new Error(`No network/scheme registered for x402 version: ${x402Version2} which comply with the payment requirements. ${JSON.stringify({
            x402Version: x402Version2,
            paymentRequirements,
            x402Versions: Array.from(this.registeredClientSchemes.keys()),
            networks: Array.from(clientSchemesByNetwork.keys()),
            schemes: Array.from(clientSchemesByNetwork.values()).map((schemes) => Array.from(schemes.keys())).flat()
          })}`);
        }
        let filteredRequirements = supportedPaymentRequirements;
        for (const policy of this.policies) {
          filteredRequirements = policy(x402Version2, filteredRequirements);
          if (filteredRequirements.length === 0) {
            throw new Error(`All payment requirements were filtered out by policies for x402 version: ${x402Version2}`);
          }
        }
        return this.paymentRequirementsSelector(x402Version2, filteredRequirements);
      }
      /**
       * Internal method to register a scheme client.
       *
       * @param x402Version - The x402 protocol version
       * @param network - The network to register the client for
       * @param client - The scheme network client to register
       * @returns The x402Client instance for chaining
       */
      _registerScheme(x402Version2, network, client) {
        if (!this.registeredClientSchemes.has(x402Version2)) {
          this.registeredClientSchemes.set(x402Version2, /* @__PURE__ */ new Map());
        }
        const clientSchemesByNetwork = this.registeredClientSchemes.get(x402Version2);
        if (!clientSchemesByNetwork.has(network)) {
          clientSchemesByNetwork.set(network, /* @__PURE__ */ new Map());
        }
        const clientByScheme = clientSchemesByNetwork.get(network);
        if (!clientByScheme.has(client.scheme)) {
          clientByScheme.set(client.scheme, client);
        }
        return this;
      }
    };
  }
});

// ../node_modules/@x402/core/dist/esm/http/index.mjs
var init_http = __esm({
  "../node_modules/@x402/core/dist/esm/http/index.mjs"() {
    "use strict";
    init_chunk_CM4FD6HG();
    init_chunk_VE37GDG2();
    init_chunk_HRQUGJ3Y();
    init_chunk_TDLQZ6MP();
    init_chunk_BJTO5JO5();
  }
});

// ../node_modules/@x402/fetch/dist/esm/index.mjs
var esm_exports = {};
__export(esm_exports, {
  decodePaymentResponseHeader: () => decodePaymentResponseHeader,
  wrapFetchWithPayment: () => wrapFetchWithPayment,
  wrapFetchWithPaymentFromConfig: () => wrapFetchWithPaymentFromConfig,
  x402Client: () => x402Client,
  x402HTTPClient: () => x402HTTPClient
});
function wrapFetchWithPayment(fetch2, client) {
  const httpClient = client instanceof x402HTTPClient ? client : new x402HTTPClient(client);
  return async (input, init) => {
    const request = new Request(input, init);
    const clonedRequest = request.clone();
    const response = await fetch2(request);
    if (response.status !== 402) {
      return response;
    }
    let paymentRequired;
    try {
      const getHeader = (name) => response.headers.get(name);
      let body;
      try {
        const responseText = await response.text();
        if (responseText) {
          body = JSON.parse(responseText);
        }
      } catch {
      }
      paymentRequired = httpClient.getPaymentRequiredResponse(getHeader, body);
    } catch (error) {
      throw new Error(
        `Failed to parse payment requirements: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
    const hookHeaders = await httpClient.handlePaymentRequired(paymentRequired);
    if (hookHeaders) {
      const hookRequest = clonedRequest.clone();
      for (const [key, value] of Object.entries(hookHeaders)) {
        hookRequest.headers.set(key, value);
      }
      const hookResponse = await fetch2(hookRequest);
      if (hookResponse.status !== 402) {
        return hookResponse;
      }
    }
    let paymentPayload;
    try {
      paymentPayload = await client.createPaymentPayload(paymentRequired);
    } catch (error) {
      throw new Error(
        `Failed to create payment payload: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
    if (clonedRequest.headers.has("PAYMENT-SIGNATURE") || clonedRequest.headers.has("X-PAYMENT")) {
      throw new Error("Payment already attempted");
    }
    for (const [key, value] of Object.entries(paymentHeaders)) {
      clonedRequest.headers.set(key, value);
    }
    clonedRequest.headers.set(
      "Access-Control-Expose-Headers",
      "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE"
    );
    const secondResponse = await fetch2(clonedRequest);
    return secondResponse;
  };
}
function wrapFetchWithPaymentFromConfig(fetch2, config) {
  const client = x402Client.fromConfig(config);
  return wrapFetchWithPayment(fetch2, client);
}
var init_esm = __esm({
  "../node_modules/@x402/fetch/dist/esm/index.mjs"() {
    "use strict";
    init_client();
    init_client();
    init_http();
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  INKD_ACTIONS: () => INKD_ACTIONS,
  InkdActionProvider: () => InkdActionProvider
});
module.exports = __toCommonJS(index_exports);

// src/provider.ts
var import_zod2 = require("zod");

// src/actions.ts
var import_zod = require("zod");
var CreateProjectSchema = import_zod.z.object({
  name: import_zod.z.string().min(1).max(64).describe(
    "Unique project name (1-64 chars). Once registered on-chain, this name is permanent."
  ),
  description: import_zod.z.string().max(256).optional().describe(
    "Short description of the project (max 256 chars)."
  ),
  license: import_zod.z.enum(["MIT", "Apache-2.0", "GPL-3.0", "Proprietary", "UNLICENSED"]).optional().describe(
    "Open source license. Defaults to MIT."
  ),
  isPublic: import_zod.z.boolean().optional().describe(
    "REQUIRED DECISION \u2014 set this explicitly. true = code stored publicly on Arweave, anyone can read it. false = code encrypted client-side with AES-256-GCM, only authorized wallets can decrypt. Default: true. Cannot be changed after project creation."
  ),
  isAgent: import_zod.z.boolean().optional().describe(
    "Mark this project as an AI agent. Enables discovery via inkd_list_agents."
  ),
  agentEndpoint: import_zod.z.string().url().optional().describe(
    "If isAgent=true, the HTTP endpoint where this agent can be called."
  )
});
var PushVersionSchema = import_zod.z.object({
  projectId: import_zod.z.string().describe(
    "The numeric ID of the project to push a version to."
  ),
  tag: import_zod.z.string().min(1).max(64).describe(
    'Version tag, e.g. "v1.0.0", "alpha", "2025-03-04".'
  ),
  contentHash: import_zod.z.string().min(1).describe(
    "Arweave hash (ar://...) or IPFS hash (ipfs://...) of the content to register."
  ),
  metadataHash: import_zod.z.string().optional().describe(
    "Optional Arweave or IPFS hash of additional metadata."
  )
});
var GetProjectSchema = import_zod.z.object({
  projectId: import_zod.z.string().describe("The numeric project ID to look up.")
});
var ListAgentsSchema = import_zod.z.object({
  limit: import_zod.z.number().int().min(1).max(100).optional().describe(
    "Maximum number of agents to return. Default: 20."
  ),
  offset: import_zod.z.number().int().min(0).optional().describe(
    "Pagination offset. Default: 0."
  )
});
var INKD_ACTIONS = {
  CREATE_PROJECT: "inkd_create_project",
  PUSH_VERSION: "inkd_push_version",
  GET_PROJECT: "inkd_get_project",
  GET_LATEST_VERSION: "inkd_get_latest_version",
  LIST_AGENTS: "inkd_list_agents",
  SEARCH_PROJECTS: "inkd_search_projects",
  GET_BUYBACKS: "inkd_get_buybacks",
  GET_STATS: "inkd_get_stats"
};
var GetLatestVersionSchema = import_zod.z.object({
  projectId: import_zod.z.string().describe("The numeric project ID to get the latest version for.")
});
var SearchProjectsSchema = import_zod.z.object({
  query: import_zod.z.string().describe("Name or keyword to search for."),
  limit: import_zod.z.number().int().min(1).max(50).optional().describe("Max results. Default: 10.")
});

// src/provider.ts
var DEFAULT_API_URL = "https://api.inkdprotocol.com";
var InkdActionProvider = class {
  name = "inkd";
  apiUrl;
  fetch;
  constructor(config = {}) {
    this.apiUrl = config.apiUrl ?? DEFAULT_API_URL;
    this.fetch = globalThis.fetch;
  }
  /**
   * Returns all actions available from this provider.
   * AgentKit calls this to register actions with the LLM.
   */
  getActions() {
    return [
      this.createProjectAction(),
      this.pushVersionAction(),
      this.getProjectAction(),
      this.getLatestVersionAction(),
      this.listAgentsAction(),
      this.searchProjectsAction(),
      this.getBuybacksAction(),
      this.getStatsAction()
    ];
  }
  // ─── inkd_create_project ──────────────────────────────────────────────────
  createProjectAction() {
    return {
      name: INKD_ACTIONS.CREATE_PROJECT,
      description: `Register a new project on inkd Protocol on Base. Costs $0.10 USDC via x402 (auto-paid). The agent wallet becomes the on-chain owner permanently. Returns projectId, txHash, owner address.`,
      schema: CreateProjectSchema,
      invoke: async (params, context) => {
        const walletAddress = await this.getWalletAddress(context);
        const fetchFn = await this.buildFetch(context);
        const res = await fetchFn(`${this.apiUrl}/v1/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: params.name,
            description: params.description ?? "",
            license: params.license ?? "MIT",
            isPublic: params.isPublic ?? true,
            isAgent: params.isAgent ?? false,
            agentEndpoint: params.agentEndpoint ?? ""
          })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
          throw new Error(`inkd createProject failed: ${JSON.stringify(err)}`);
        }
        const result = await res.json();
        return {
          success: true,
          projectId: result.projectId,
          txHash: result.txHash,
          owner: result.owner ?? walletAddress,
          message: `Project "${params.name}" registered on-chain as #${result.projectId}. Owner: ${result.owner}. TX: ${result.txHash}`
        };
      }
    };
  }
  // ─── inkd_push_version ────────────────────────────────────────────────────
  pushVersionAction() {
    return {
      name: INKD_ACTIONS.PUSH_VERSION,
      description: `Upload content to Arweave and register the version on-chain. Costs Arweave storage + 20% markup (min $0.10 USDC), paid automatically via x402. Nothing is overwritten \u2014 all versions are permanent. Returns txHash, arweaveHash, versionTag.`,
      schema: PushVersionSchema,
      invoke: async (params, context) => {
        const fetchFn = await this.buildFetch(context);
        const res = await fetchFn(
          `${this.apiUrl}/v1/projects/${params.projectId}/versions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              versionTag: params.tag,
              arweaveHash: params.contentHash,
              changelog: params.metadataHash ?? "",
              contentSize: 0
            })
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
          throw new Error(`inkd pushVersion failed: ${JSON.stringify(err)}`);
        }
        const result = await res.json();
        return {
          success: true,
          txHash: result.txHash,
          projectId: params.projectId,
          tag: params.tag,
          message: `Version "${params.tag}" pushed to project #${params.projectId}. TX: ${result.txHash}`
        };
      }
    };
  }
  // ─── inkd_get_project ─────────────────────────────────────────────────────
  getProjectAction() {
    return {
      name: INKD_ACTIONS.GET_PROJECT,
      description: `Get details about an inkd project by ID. Returns project metadata including owner, version count, license, and description. Free \u2014 no payment needed.`,
      schema: GetProjectSchema,
      invoke: async (params) => {
        const res = await this.fetch(`${this.apiUrl}/v1/projects/${params.projectId}`);
        if (res.status === 404) {
          return { success: false, message: `Project #${params.projectId} not found.` };
        }
        if (!res.ok) throw new Error(`inkd getProject failed: ${res.statusText}`);
        const { data } = await res.json();
        return {
          success: true,
          project: data,
          message: `Project #${data.id}: "${data.name}" by ${data.owner}. ${data.versionCount} versions. License: ${data.license}.`
        };
      }
    };
  }
  // ─── inkd_get_latest_version ──────────────────────────────────────────────
  getLatestVersionAction() {
    return {
      name: INKD_ACTIONS.GET_LATEST_VERSION,
      description: `Get the latest version of an inkd project. Returns arweaveHash, versionTag, and Arweave URL. Use this to check if a tool or dependency has been updated. Free \u2014 no payment needed.`,
      schema: GetLatestVersionSchema,
      invoke: async (params) => {
        const res = await this.fetch(`${this.apiUrl}/v1/projects/${params.projectId}/versions?limit=1`);
        if (!res.ok) throw new Error(`inkd getLatestVersion failed: ${res.statusText}`);
        const { data } = await res.json();
        if (!data?.length) return { success: false, message: `No versions found for project #${params.projectId}.` };
        const v = data[0];
        return {
          success: true,
          version: v,
          arweaveUrl: `https://arweave.net/${v.arweaveHash}`,
          message: `Latest version of #${params.projectId}: ${v.versionTag} \u2014 https://arweave.net/${v.arweaveHash}`
        };
      }
    };
  }
  // ─── inkd_search_projects ─────────────────────────────────────────────────
  searchProjectsAction() {
    return {
      name: INKD_ACTIONS.SEARCH_PROJECTS,
      description: `Search public inkd projects by name. Use to discover tools, libraries, or agents registered on-chain. Free \u2014 no payment needed.`,
      schema: SearchProjectsSchema,
      invoke: async (params) => {
        const qs = new URLSearchParams({ q: params.query, limit: String(params.limit ?? 10) });
        const res = await this.fetch(`${this.apiUrl}/v1/search/projects?${qs}`);
        if (!res.ok) throw new Error(`inkd searchProjects failed: ${res.statusText}`);
        const { data, total } = await res.json();
        return {
          success: true,
          results: data,
          total,
          message: `Found ${total} projects matching "${params.query}". Showing ${data.length}.`
        };
      }
    };
  }
  // ─── inkd_get_buybacks ────────────────────────────────────────────────────
  getBuybacksAction() {
    return {
      name: INKD_ACTIONS.GET_BUYBACKS,
      description: "Get recent $INKD buyback events \u2014 USDC spent, $INKD received, Basescan links, and totals.",
      schema: import_zod2.z.object({
        limit: import_zod2.z.number().int().min(1).max(100).default(20).describe("Number of events to return"),
        skip: import_zod2.z.number().int().min(0).default(0).describe("Offset for pagination")
      }),
      async invoke(params) {
        const limit = params.limit ?? 20;
        const skip = params.skip ?? 0;
        const res = await globalThis.fetch(`https://api.inkdprotocol.com/v1/buybacks?limit=${limit}&skip=${skip}`);
        if (!res.ok) throw new Error(`inkd getBuybacks failed: ${res.statusText}`);
        const data = await res.json();
        return { success: true, ...data };
      }
    };
  }
  // ─── inkd_get_stats ───────────────────────────────────────────────────────
  getStatsAction() {
    return {
      name: INKD_ACTIONS.GET_STATS,
      description: "Get protocol-wide stats: total projects, versions, USDC volume processed, $INKD token supply.",
      schema: import_zod2.z.object({}),
      async invoke() {
        const res = await globalThis.fetch("https://api.inkdprotocol.com/v1/stats");
        if (!res.ok) throw new Error(`inkd getStats failed: ${res.statusText}`);
        const data = await res.json();
        return { success: true, ...data };
      }
    };
  }
  // ─── inkd_list_agents ─────────────────────────────────────────────────────
  listAgentsAction() {
    return {
      name: INKD_ACTIONS.LIST_AGENTS,
      description: `Discover AI agents registered on inkd Protocol. Returns a list of agents with their endpoints, owners, and project IDs. Free \u2014 no payment needed.`,
      schema: ListAgentsSchema,
      invoke: async (params) => {
        const qs = new URLSearchParams({
          limit: String(params.limit ?? 20),
          offset: String(params.offset ?? 0)
        });
        const res = await this.fetch(`${this.apiUrl}/v1/agents?${qs}`);
        if (!res.ok) throw new Error(`inkd listAgents failed: ${res.statusText}`);
        const { data, total } = await res.json();
        return {
          success: true,
          agents: data,
          total,
          message: `Found ${total} registered agents. Showing ${data.length}.`
        };
      }
    };
  }
  // ─── Helpers ──────────────────────────────────────────────────────────────
  /**
   * Build an x402-enabled fetch if AgentKit wallet context is available.
   * Falls back to plain fetch for read-only actions.
   */
  async buildFetch(context) {
    if (!context?.walletProvider) return this.fetch;
    try {
      const { wrapFetchWithPayment: wrapFetchWithPayment2 } = await Promise.resolve().then(() => (init_esm(), esm_exports));
      const { privateKeyToAccount } = await import("viem/accounts");
      const { base, baseSepolia } = await import("viem/chains");
      const privateKey = context.walletProvider?.privateKey;
      if (!privateKey) return this.fetch;
      const account = privateKeyToAccount(privateKey);
      const chain = this.apiUrl.includes("sepolia") ? baseSepolia : base;
      return wrapFetchWithPayment2(account, chain);
    } catch {
      return this.fetch;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getWalletAddress(context) {
    try {
      return await context?.walletProvider?.getAddress?.();
    } catch {
      return void 0;
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  INKD_ACTIONS,
  InkdActionProvider
});
