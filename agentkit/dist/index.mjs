var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
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

// src/actions.js
var require_actions = __commonJS({
  "src/actions.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.INKD_ACTIONS = exports.ListAgentsSchema = exports.GetProjectSchema = exports.PushVersionSchema = exports.CreateProjectSchema = void 0;
    var zod_1 = __require("zod");
    exports.CreateProjectSchema = zod_1.z.object({
      name: zod_1.z.string().min(1).max(64).describe("Unique project name (1-64 chars). Once registered on-chain, this name is permanent."),
      description: zod_1.z.string().max(256).optional().describe("Short description of the project (max 256 chars)."),
      license: zod_1.z.enum(["MIT", "Apache-2.0", "GPL-3.0", "Proprietary", "UNLICENSED"]).optional().describe("Open source license. Defaults to MIT."),
      isPublic: zod_1.z.boolean().optional().describe("REQUIRED DECISION \u2014 set this explicitly. true = code stored publicly on Arweave, anyone can read it. false = code encrypted client-side with AES-256-GCM, only authorized wallets can decrypt. Default: true. Cannot be changed after project creation."),
      isAgent: zod_1.z.boolean().optional().describe("Mark this project as an AI agent. Enables discovery via inkd_list_agents."),
      agentEndpoint: zod_1.z.string().url().optional().describe("If isAgent=true, the HTTP endpoint where this agent can be called.")
    });
    exports.PushVersionSchema = zod_1.z.object({
      projectId: zod_1.z.string().describe("The numeric ID of the project to push a version to."),
      tag: zod_1.z.string().min(1).max(64).describe('Version tag, e.g. "v1.0.0", "alpha", "2025-03-04".'),
      contentHash: zod_1.z.string().min(1).describe("Arweave hash (ar://...) or IPFS hash (ipfs://...) of the content to register."),
      metadataHash: zod_1.z.string().optional().describe("Optional Arweave or IPFS hash of additional metadata.")
    });
    exports.GetProjectSchema = zod_1.z.object({
      projectId: zod_1.z.string().describe("The numeric project ID to look up.")
    });
    exports.ListAgentsSchema = zod_1.z.object({
      limit: zod_1.z.number().int().min(1).max(100).optional().describe("Maximum number of agents to return. Default: 20."),
      offset: zod_1.z.number().int().min(0).optional().describe("Pagination offset. Default: 0.")
    });
    exports.INKD_ACTIONS = {
      CREATE_PROJECT: "inkd_create_project",
      PUSH_VERSION: "inkd_push_version",
      GET_PROJECT: "inkd_get_project",
      LIST_AGENTS: "inkd_list_agents"
    };
  }
});

// node_modules/@x402/core/dist/cjs/client/index.js
var require_client = __commonJS({
  "node_modules/@x402/core/dist/cjs/client/index.js"(exports, module) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames2 = Object.getOwnPropertyNames;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp2(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps2 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
    var client_exports = {};
    __export(client_exports, {
      x402Client: () => x402Client2,
      x402HTTPClient: () => x402HTTPClient2
    });
    module.exports = __toCommonJS(client_exports);
    var x402Version = 2;
    var findSchemesByNetwork = (map, network) => {
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
    var findByNetworkAndScheme = (map, scheme, network) => {
      return findSchemesByNetwork(map, network)?.get(scheme);
    };
    var Base64EncodedRegex = /^[A-Za-z0-9+/]*={0,2}$/;
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
    var x402Client2 = class _x402Client {
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
    function encodePaymentSignatureHeader(paymentPayload) {
      return safeBase64Encode(JSON.stringify(paymentPayload));
    }
    function decodePaymentRequiredHeader(paymentRequiredHeader) {
      if (!Base64EncodedRegex.test(paymentRequiredHeader)) {
        throw new Error("Invalid payment required header");
      }
      return JSON.parse(safeBase64Decode(paymentRequiredHeader));
    }
    function decodePaymentResponseHeader2(paymentResponseHeader) {
      if (!Base64EncodedRegex.test(paymentResponseHeader)) {
        throw new Error("Invalid payment response header");
      }
      return JSON.parse(safeBase64Decode(paymentResponseHeader));
    }
    var x402HTTPClient2 = class {
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
          return decodePaymentResponseHeader2(paymentResponse);
        }
        const xPaymentResponse = getHeader("X-PAYMENT-RESPONSE");
        if (xPaymentResponse) {
          return decodePaymentResponseHeader2(xPaymentResponse);
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

// node_modules/@x402/core/dist/cjs/http/index.js
var require_http = __commonJS({
  "node_modules/@x402/core/dist/cjs/http/index.js"(exports, module) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames2 = Object.getOwnPropertyNames;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp2(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps2 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
    var http_exports = {};
    __export(http_exports, {
      HTTPFacilitatorClient: () => HTTPFacilitatorClient,
      RouteConfigurationError: () => RouteConfigurationError,
      decodePaymentRequiredHeader: () => decodePaymentRequiredHeader,
      decodePaymentResponseHeader: () => decodePaymentResponseHeader2,
      decodePaymentSignatureHeader: () => decodePaymentSignatureHeader,
      encodePaymentRequiredHeader: () => encodePaymentRequiredHeader,
      encodePaymentResponseHeader: () => encodePaymentResponseHeader,
      encodePaymentSignatureHeader: () => encodePaymentSignatureHeader,
      x402HTTPClient: () => x402HTTPClient2,
      x402HTTPResourceServer: () => x402HTTPResourceServer
    });
    module.exports = __toCommonJS(http_exports);
    var Base64EncodedRegex = /^[A-Za-z0-9+/]*={0,2}$/;
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
    var VerifyError = class extends Error {
      /**
       * Creates a VerifyError from a failed verification response.
       *
       * @param statusCode - HTTP status code from the facilitator
       * @param response - The verify response containing error details
       */
      constructor(statusCode, response) {
        const reason = response.invalidReason || "unknown reason";
        const message = response.invalidMessage;
        super(message ? `${reason}: ${message}` : reason);
        this.name = "VerifyError";
        this.statusCode = statusCode;
        this.invalidReason = response.invalidReason;
        this.invalidMessage = response.invalidMessage;
        this.payer = response.payer;
      }
    };
    var SettleError = class extends Error {
      /**
       * Creates a SettleError from a failed settlement response.
       *
       * @param statusCode - HTTP status code from the facilitator
       * @param response - The settle response containing error details
       */
      constructor(statusCode, response) {
        const reason = response.errorReason || "unknown reason";
        const message = response.errorMessage;
        super(message ? `${reason}: ${message}` : reason);
        this.name = "SettleError";
        this.statusCode = statusCode;
        this.errorReason = response.errorReason;
        this.errorMessage = response.errorMessage;
        this.payer = response.payer;
        this.transaction = response.transaction;
        this.network = response.network;
      }
    };
    var x402Version = 2;
    var RouteConfigurationError = class extends Error {
      /**
       * Creates a new RouteConfigurationError with the given validation errors.
       *
       * @param errors - The validation errors that caused this exception.
       */
      constructor(errors) {
        const message = `x402 Route Configuration Errors:
${errors.map((e) => `  - ${e.message}`).join("\n")}`;
        super(message);
        this.name = "RouteConfigurationError";
        this.errors = errors;
      }
    };
    var x402HTTPResourceServer = class {
      /**
       * Creates a new x402HTTPResourceServer instance.
       *
       * @param ResourceServer - The core x402ResourceServer instance to use
       * @param routes - Route configuration for payment-protected endpoints
       */
      constructor(ResourceServer, routes) {
        this.compiledRoutes = [];
        this.protectedRequestHooks = [];
        this.ResourceServer = ResourceServer;
        this.routesConfig = routes;
        const normalizedRoutes = typeof routes === "object" && !("accepts" in routes) ? routes : { "*": routes };
        for (const [pattern, config] of Object.entries(normalizedRoutes)) {
          const parsed = this.parseRoutePattern(pattern);
          this.compiledRoutes.push({
            verb: parsed.verb,
            regex: parsed.regex,
            config
          });
        }
      }
      /**
       * Get the underlying x402ResourceServer instance.
       *
       * @returns The underlying x402ResourceServer instance
       */
      get server() {
        return this.ResourceServer;
      }
      /**
       * Get the routes configuration.
       *
       * @returns The routes configuration
       */
      get routes() {
        return this.routesConfig;
      }
      /**
       * Initialize the HTTP resource server.
       *
       * This method initializes the underlying resource server (fetching facilitator support)
       * and then validates that all route payment configurations have corresponding
       * registered schemes and facilitator support.
       *
       * @throws RouteConfigurationError if any route's payment options don't have
       *         corresponding registered schemes or facilitator support
       *
       * @example
       * ```typescript
       * const httpServer = new x402HTTPResourceServer(server, routes);
       * await httpServer.initialize();
       * ```
       */
      async initialize() {
        await this.ResourceServer.initialize();
        const errors = this.validateRouteConfiguration();
        if (errors.length > 0) {
          throw new RouteConfigurationError(errors);
        }
      }
      /**
       * Register a custom paywall provider for generating HTML
       *
       * @param provider - PaywallProvider instance
       * @returns This service instance for chaining
       */
      registerPaywallProvider(provider) {
        this.paywallProvider = provider;
        return this;
      }
      /**
       * Register a hook that runs on every request to a protected route, before payment processing.
       * Hooks are executed in order of registration. The first hook to return a non-void result wins.
       *
       * @param hook - The request hook function
       * @returns The x402HTTPResourceServer instance for chaining
       */
      onProtectedRequest(hook) {
        this.protectedRequestHooks.push(hook);
        return this;
      }
      /**
       * Process HTTP request and return response instructions
       * This is the main entry point for framework middleware
       *
       * @param context - HTTP request context
       * @param paywallConfig - Optional paywall configuration
       * @returns Process result indicating next action for middleware
       */
      async processHTTPRequest(context, paywallConfig) {
        const { adapter, path, method } = context;
        const routeConfig = this.getRouteConfig(path, method);
        if (!routeConfig) {
          return { type: "no-payment-required" };
        }
        for (const hook of this.protectedRequestHooks) {
          const result = await hook(context, routeConfig);
          if (result && "grantAccess" in result) {
            return { type: "no-payment-required" };
          }
          if (result && "abort" in result) {
            return {
              type: "payment-error",
              response: {
                status: 403,
                headers: { "Content-Type": "application/json" },
                body: { error: result.reason }
              }
            };
          }
        }
        const paymentOptions = this.normalizePaymentOptions(routeConfig);
        const paymentPayload = this.extractPayment(adapter);
        const resourceInfo = {
          url: routeConfig.resource || context.adapter.getUrl(),
          description: routeConfig.description || "",
          mimeType: routeConfig.mimeType || ""
        };
        let requirements = await this.ResourceServer.buildPaymentRequirementsFromOptions(
          paymentOptions,
          context
        );
        let extensions = routeConfig.extensions;
        if (extensions) {
          extensions = this.ResourceServer.enrichExtensions(extensions, context);
        }
        const transportContext = { request: context };
        const paymentRequired = await this.ResourceServer.createPaymentRequiredResponse(
          requirements,
          resourceInfo,
          !paymentPayload ? "Payment required" : void 0,
          extensions,
          transportContext
        );
        if (!paymentPayload) {
          const unpaidBody = routeConfig.unpaidResponseBody ? await routeConfig.unpaidResponseBody(context) : void 0;
          return {
            type: "payment-error",
            response: this.createHTTPResponse(
              paymentRequired,
              this.isWebBrowser(adapter),
              paywallConfig,
              routeConfig.customPaywallHtml,
              unpaidBody
            )
          };
        }
        try {
          const matchingRequirements = this.ResourceServer.findMatchingRequirements(
            paymentRequired.accepts,
            paymentPayload
          );
          if (!matchingRequirements) {
            const errorResponse = await this.ResourceServer.createPaymentRequiredResponse(
              requirements,
              resourceInfo,
              "No matching payment requirements",
              routeConfig.extensions,
              transportContext
            );
            return {
              type: "payment-error",
              response: this.createHTTPResponse(errorResponse, false, paywallConfig)
            };
          }
          const verifyResult = await this.ResourceServer.verifyPayment(
            paymentPayload,
            matchingRequirements
          );
          if (!verifyResult.isValid) {
            const errorResponse = await this.ResourceServer.createPaymentRequiredResponse(
              requirements,
              resourceInfo,
              verifyResult.invalidReason,
              routeConfig.extensions,
              transportContext
            );
            return {
              type: "payment-error",
              response: this.createHTTPResponse(errorResponse, false, paywallConfig)
            };
          }
          return {
            type: "payment-verified",
            paymentPayload,
            paymentRequirements: matchingRequirements,
            declaredExtensions: routeConfig.extensions
          };
        } catch (error) {
          const errorResponse = await this.ResourceServer.createPaymentRequiredResponse(
            requirements,
            resourceInfo,
            error instanceof Error ? error.message : "Payment verification failed",
            routeConfig.extensions,
            transportContext
          );
          return {
            type: "payment-error",
            response: this.createHTTPResponse(errorResponse, false, paywallConfig)
          };
        }
      }
      /**
       * Process settlement after successful response
       *
       * @param paymentPayload - The verified payment payload
       * @param requirements - The matching payment requirements
       * @param declaredExtensions - Optional declared extensions (for per-key enrichment)
       * @param transportContext - Optional HTTP transport context
       * @returns ProcessSettleResultResponse - SettleResponse with headers if success or errorReason if failure
       */
      async processSettlement(paymentPayload, requirements, declaredExtensions, transportContext) {
        try {
          const settleResponse = await this.ResourceServer.settlePayment(
            paymentPayload,
            requirements,
            declaredExtensions,
            transportContext
          );
          if (!settleResponse.success) {
            return {
              ...settleResponse,
              success: false,
              errorReason: settleResponse.errorReason || "Settlement failed",
              errorMessage: settleResponse.errorMessage || settleResponse.errorReason || "Settlement failed"
            };
          }
          return {
            ...settleResponse,
            success: true,
            headers: this.createSettlementHeaders(settleResponse),
            requirements
          };
        } catch (error) {
          if (error instanceof SettleError) {
            return {
              success: false,
              errorReason: error.errorReason || error.message,
              errorMessage: error.errorMessage || error.errorReason || error.message,
              payer: error.payer,
              network: error.network,
              transaction: error.transaction
            };
          }
          return {
            success: false,
            errorReason: error instanceof Error ? error.message : "Settlement failed",
            errorMessage: error instanceof Error ? error.message : "Settlement failed",
            network: requirements.network,
            transaction: ""
          };
        }
      }
      /**
       * Check if a request requires payment based on route configuration
       *
       * @param context - HTTP request context
       * @returns True if the route requires payment, false otherwise
       */
      requiresPayment(context) {
        const routeConfig = this.getRouteConfig(context.path, context.method);
        return routeConfig !== void 0;
      }
      /**
       * Normalizes a RouteConfig's accepts field into an array of PaymentOptions
       * Handles both single PaymentOption and array formats
       *
       * @param routeConfig - Route configuration
       * @returns Array of payment options
       */
      normalizePaymentOptions(routeConfig) {
        return Array.isArray(routeConfig.accepts) ? routeConfig.accepts : [routeConfig.accepts];
      }
      /**
       * Validates that all payment options in routes have corresponding registered schemes
       * and facilitator support.
       *
       * @returns Array of validation errors (empty if all routes are valid)
       */
      validateRouteConfiguration() {
        const errors = [];
        const normalizedRoutes = typeof this.routesConfig === "object" && !("accepts" in this.routesConfig) ? Object.entries(this.routesConfig) : [["*", this.routesConfig]];
        for (const [pattern, config] of normalizedRoutes) {
          const paymentOptions = this.normalizePaymentOptions(config);
          for (const option of paymentOptions) {
            if (!this.ResourceServer.hasRegisteredScheme(option.network, option.scheme)) {
              errors.push({
                routePattern: pattern,
                scheme: option.scheme,
                network: option.network,
                reason: "missing_scheme",
                message: `Route "${pattern}": No scheme implementation registered for "${option.scheme}" on network "${option.network}"`
              });
              continue;
            }
            const supportedKind = this.ResourceServer.getSupportedKind(
              x402Version,
              option.network,
              option.scheme
            );
            if (!supportedKind) {
              errors.push({
                routePattern: pattern,
                scheme: option.scheme,
                network: option.network,
                reason: "missing_facilitator",
                message: `Route "${pattern}": Facilitator does not support scheme "${option.scheme}" on network "${option.network}"`
              });
            }
          }
        }
        return errors;
      }
      /**
       * Get route configuration for a request
       *
       * @param path - Request path
       * @param method - HTTP method
       * @returns Route configuration or undefined if no match
       */
      getRouteConfig(path, method) {
        const normalizedPath = this.normalizePath(path);
        const upperMethod = method.toUpperCase();
        const matchingRoute = this.compiledRoutes.find(
          (route) => route.regex.test(normalizedPath) && (route.verb === "*" || route.verb === upperMethod)
        );
        return matchingRoute?.config;
      }
      /**
       * Extract payment from HTTP headers (handles v1 and v2)
       *
       * @param adapter - HTTP adapter
       * @returns Decoded payment payload or null
       */
      extractPayment(adapter) {
        const header = adapter.getHeader("payment-signature") || adapter.getHeader("PAYMENT-SIGNATURE");
        if (header) {
          try {
            return decodePaymentSignatureHeader(header);
          } catch (error) {
            console.warn("Failed to decode PAYMENT-SIGNATURE header:", error);
          }
        }
        return null;
      }
      /**
       * Check if request is from a web browser
       *
       * @param adapter - HTTP adapter
       * @returns True if request appears to be from a browser
       */
      isWebBrowser(adapter) {
        const accept = adapter.getAcceptHeader();
        const userAgent = adapter.getUserAgent();
        return accept.includes("text/html") && userAgent.includes("Mozilla");
      }
      /**
       * Create HTTP response instructions from payment required
       *
       * @param paymentRequired - Payment requirements
       * @param isWebBrowser - Whether request is from browser
       * @param paywallConfig - Paywall configuration
       * @param customHtml - Custom HTML template
       * @param unpaidResponse - Optional custom response (content type and body) for unpaid API requests
       * @returns Response instructions
       */
      createHTTPResponse(paymentRequired, isWebBrowser, paywallConfig, customHtml, unpaidResponse) {
        const status = paymentRequired.error === "permit2_allowance_required" ? 412 : 402;
        if (isWebBrowser) {
          const html = this.generatePaywallHTML(paymentRequired, paywallConfig, customHtml);
          return {
            status,
            headers: { "Content-Type": "text/html" },
            body: html,
            isHtml: true
          };
        }
        const response = this.createHTTPPaymentRequiredResponse(paymentRequired);
        const contentType = unpaidResponse ? unpaidResponse.contentType : "application/json";
        const body = unpaidResponse ? unpaidResponse.body : {};
        return {
          status,
          headers: {
            "Content-Type": contentType,
            ...response.headers
          },
          body
        };
      }
      /**
       * Create HTTP payment required response (v1 puts in body, v2 puts in header)
       *
       * @param paymentRequired - Payment required object
       * @returns Headers and body for the HTTP response
       */
      createHTTPPaymentRequiredResponse(paymentRequired) {
        return {
          headers: {
            "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired)
          }
        };
      }
      /**
       * Create settlement response headers
       *
       * @param settleResponse - Settlement response
       * @returns Headers to add to response
       */
      createSettlementHeaders(settleResponse) {
        const encoded = encodePaymentResponseHeader(settleResponse);
        return { "PAYMENT-RESPONSE": encoded };
      }
      /**
       * Parse route pattern into verb and regex
       *
       * @param pattern - Route pattern like "GET /api/*" or "/api/[id]"
       * @returns Parsed pattern with verb and regex
       */
      parseRoutePattern(pattern) {
        const [verb, path] = pattern.includes(" ") ? pattern.split(/\s+/) : ["*", pattern];
        const regex = new RegExp(
          `^${path.replace(/[$()+.?^{|}]/g, "\\$&").replace(/\*/g, ".*?").replace(/\[([^\]]+)\]/g, "[^/]+").replace(/\//g, "\\/")}$`,
          "i"
        );
        return { verb: verb.toUpperCase(), regex };
      }
      /**
       * Normalize path for matching
       *
       * @param path - Raw path from request
       * @returns Normalized path
       */
      normalizePath(path) {
        const pathWithoutQuery = path.split(/[?#]/)[0];
        let decodedOrRawPath;
        try {
          decodedOrRawPath = decodeURIComponent(pathWithoutQuery);
        } catch {
          decodedOrRawPath = pathWithoutQuery;
        }
        return decodedOrRawPath.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/(.+?)\/+$/, "$1");
      }
      /**
       * Generate paywall HTML for browser requests
       *
       * @param paymentRequired - Payment required response
       * @param paywallConfig - Optional paywall configuration
       * @param customHtml - Optional custom HTML template
       * @returns HTML string
       */
      generatePaywallHTML(paymentRequired, paywallConfig, customHtml) {
        if (customHtml) {
          return customHtml;
        }
        if (this.paywallProvider) {
          return this.paywallProvider.generateHtml(paymentRequired, paywallConfig);
        }
        try {
          const paywall = __require("@x402/paywall");
          const displayAmount2 = this.getDisplayAmount(paymentRequired);
          const resource2 = paymentRequired.resource;
          return paywall.getPaywallHtml({
            amount: displayAmount2,
            paymentRequired,
            currentUrl: resource2?.url || paywallConfig?.currentUrl || "",
            testnet: paywallConfig?.testnet ?? true,
            appName: paywallConfig?.appName,
            appLogo: paywallConfig?.appLogo,
            sessionTokenEndpoint: paywallConfig?.sessionTokenEndpoint
          });
        } catch {
        }
        const resource = paymentRequired.resource;
        const displayAmount = this.getDisplayAmount(paymentRequired);
        return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Required</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <div style="max-width: 600px; margin: 50px auto; padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
            ${paywallConfig?.appLogo ? `<img src="${paywallConfig.appLogo}" alt="${paywallConfig.appName || "App"}" style="max-width: 200px; margin-bottom: 20px;">` : ""}
            <h1>Payment Required</h1>
            ${resource ? `<p><strong>Resource:</strong> ${resource.description || resource.url}</p>` : ""}
            <p><strong>Amount:</strong> $${displayAmount.toFixed(2)} USDC</p>
            <div id="payment-widget" 
                 data-requirements='${JSON.stringify(paymentRequired)}'
                 data-app-name="${paywallConfig?.appName || ""}"
                 data-testnet="${paywallConfig?.testnet || false}">
              <!-- Install @x402/paywall for full wallet integration -->
              <p style="margin-top: 2rem; padding: 1rem; background: #fef3c7; border-radius: 0.5rem;">
                <strong>Note:</strong> Install <code>@x402/paywall</code> for full wallet connection and payment UI.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
      }
      /**
       * Extract display amount from payment requirements.
       *
       * @param paymentRequired - The payment required object
       * @returns The display amount in decimal format
       */
      getDisplayAmount(paymentRequired) {
        const accepts = paymentRequired.accepts;
        if (accepts && accepts.length > 0) {
          const firstReq = accepts[0];
          if ("amount" in firstReq) {
            return parseFloat(firstReq.amount) / 1e6;
          }
        }
        return 0;
      }
    };
    var DEFAULT_FACILITATOR_URL = "https://x402.org/facilitator";
    var GET_SUPPORTED_RETRIES = 3;
    var GET_SUPPORTED_RETRY_DELAY_MS = 1e3;
    var HTTPFacilitatorClient = class {
      /**
       * Creates a new HTTPFacilitatorClient instance.
       *
       * @param config - Configuration options for the facilitator client
       */
      constructor(config) {
        this.url = config?.url || DEFAULT_FACILITATOR_URL;
        this._createAuthHeaders = config?.createAuthHeaders;
      }
      /**
       * Verify a payment with the facilitator
       *
       * @param paymentPayload - The payment to verify
       * @param paymentRequirements - The requirements to verify against
       * @returns Verification response
       */
      async verify(paymentPayload, paymentRequirements) {
        let headers = {
          "Content-Type": "application/json"
        };
        if (this._createAuthHeaders) {
          const authHeaders = await this.createAuthHeaders("verify");
          headers = { ...headers, ...authHeaders.headers };
        }
        const response = await fetch(`${this.url}/verify`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            x402Version: paymentPayload.x402Version,
            paymentPayload: this.toJsonSafe(paymentPayload),
            paymentRequirements: this.toJsonSafe(paymentRequirements)
          })
        });
        const data = await response.json();
        if (typeof data === "object" && data !== null && "isValid" in data) {
          const verifyResponse = data;
          if (!response.ok) {
            throw new VerifyError(response.status, verifyResponse);
          }
          return verifyResponse;
        }
        throw new Error(`Facilitator verify failed (${response.status}): ${JSON.stringify(data)}`);
      }
      /**
       * Settle a payment with the facilitator
       *
       * @param paymentPayload - The payment to settle
       * @param paymentRequirements - The requirements for settlement
       * @returns Settlement response
       */
      async settle(paymentPayload, paymentRequirements) {
        let headers = {
          "Content-Type": "application/json"
        };
        if (this._createAuthHeaders) {
          const authHeaders = await this.createAuthHeaders("settle");
          headers = { ...headers, ...authHeaders.headers };
        }
        const response = await fetch(`${this.url}/settle`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            x402Version: paymentPayload.x402Version,
            paymentPayload: this.toJsonSafe(paymentPayload),
            paymentRequirements: this.toJsonSafe(paymentRequirements)
          })
        });
        const data = await response.json();
        if (typeof data === "object" && data !== null && "success" in data) {
          const settleResponse = data;
          if (!response.ok) {
            throw new SettleError(response.status, settleResponse);
          }
          return settleResponse;
        }
        throw new Error(`Facilitator settle failed (${response.status}): ${JSON.stringify(data)}`);
      }
      /**
       * Get supported payment kinds and extensions from the facilitator.
       * Retries with exponential backoff on 429 rate limit errors.
       *
       * @returns Supported payment kinds and extensions
       */
      async getSupported() {
        let headers = {
          "Content-Type": "application/json"
        };
        if (this._createAuthHeaders) {
          const authHeaders = await this.createAuthHeaders("supported");
          headers = { ...headers, ...authHeaders.headers };
        }
        let lastError = null;
        for (let attempt = 0; attempt < GET_SUPPORTED_RETRIES; attempt++) {
          const response = await fetch(`${this.url}/supported`, {
            method: "GET",
            headers
          });
          if (response.ok) {
            return await response.json();
          }
          const errorText = await response.text().catch(() => response.statusText);
          lastError = new Error(`Facilitator getSupported failed (${response.status}): ${errorText}`);
          if (response.status === 429 && attempt < GET_SUPPORTED_RETRIES - 1) {
            const delay = GET_SUPPORTED_RETRY_DELAY_MS * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw lastError;
        }
        throw lastError ?? new Error("Facilitator getSupported failed after retries");
      }
      /**
       * Creates authentication headers for a specific path.
       *
       * @param path - The path to create authentication headers for (e.g., "verify", "settle", "supported")
       * @returns An object containing the authentication headers for the specified path
       */
      async createAuthHeaders(path) {
        if (this._createAuthHeaders) {
          const authHeaders = await this._createAuthHeaders();
          return {
            headers: authHeaders[path] ?? {}
          };
        }
        return {
          headers: {}
        };
      }
      /**
       * Helper to convert objects to JSON-safe format.
       * Handles BigInt and other non-JSON types.
       *
       * @param obj - The object to convert
       * @returns The JSON-safe representation of the object
       */
      toJsonSafe(obj) {
        return JSON.parse(
          JSON.stringify(obj, (_, value) => typeof value === "bigint" ? value.toString() : value)
        );
      }
    };
    var x402HTTPClient2 = class {
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
          return decodePaymentResponseHeader2(paymentResponse);
        }
        const xPaymentResponse = getHeader("X-PAYMENT-RESPONSE");
        if (xPaymentResponse) {
          return decodePaymentResponseHeader2(xPaymentResponse);
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
    function encodePaymentSignatureHeader(paymentPayload) {
      return safeBase64Encode(JSON.stringify(paymentPayload));
    }
    function decodePaymentSignatureHeader(paymentSignatureHeader) {
      if (!Base64EncodedRegex.test(paymentSignatureHeader)) {
        throw new Error("Invalid payment signature header");
      }
      return JSON.parse(safeBase64Decode(paymentSignatureHeader));
    }
    function encodePaymentRequiredHeader(paymentRequired) {
      return safeBase64Encode(JSON.stringify(paymentRequired));
    }
    function decodePaymentRequiredHeader(paymentRequiredHeader) {
      if (!Base64EncodedRegex.test(paymentRequiredHeader)) {
        throw new Error("Invalid payment required header");
      }
      return JSON.parse(safeBase64Decode(paymentRequiredHeader));
    }
    function encodePaymentResponseHeader(paymentResponse) {
      return safeBase64Encode(JSON.stringify(paymentResponse));
    }
    function decodePaymentResponseHeader2(paymentResponseHeader) {
      if (!Base64EncodedRegex.test(paymentResponseHeader)) {
        throw new Error("Invalid payment response header");
      }
      return JSON.parse(safeBase64Decode(paymentResponseHeader));
    }
  }
});

// node_modules/@x402/fetch/dist/cjs/index.js
var require_cjs = __commonJS({
  "node_modules/@x402/fetch/dist/cjs/index.js"(exports, module) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames2 = Object.getOwnPropertyNames;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp2(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps2 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
    var src_exports = {};
    __export(src_exports, {
      decodePaymentResponseHeader: () => import_http.decodePaymentResponseHeader,
      wrapFetchWithPayment: () => wrapFetchWithPayment,
      wrapFetchWithPaymentFromConfig: () => wrapFetchWithPaymentFromConfig,
      x402Client: () => import_client2.x402Client,
      x402HTTPClient: () => import_client2.x402HTTPClient
    });
    module.exports = __toCommonJS(src_exports);
    var import_client = require_client();
    var import_client2 = require_client();
    var import_http = require_http();
    function wrapFetchWithPayment(fetch2, client) {
      const httpClient = client instanceof import_client.x402HTTPClient ? client : new import_client.x402HTTPClient(client);
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
      const client = import_client.x402Client.fromConfig(config);
      return wrapFetchWithPayment(fetch2, client);
    }
  }
});

// src/provider.js
var require_provider = __commonJS({
  "src/provider.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      };
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InkdActionProvider = void 0;
    var actions_js_1 = require_actions();
    var DEFAULT_API_URL = "https://api.inkdprotocol.com";
    var InkdActionProvider2 = class {
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
          this.listAgentsAction()
        ];
      }
      // ─── inkd_create_project ──────────────────────────────────────────────────
      createProjectAction() {
        return {
          name: actions_js_1.INKD_ACTIONS.CREATE_PROJECT,
          description: `Register a new project on inkd Protocol on-chain. Locks 1 $INKD permanently. The agent's wallet address becomes the on-chain owner. Returns projectId, txHash, and owner address.`,
          schema: actions_js_1.CreateProjectSchema,
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
          name: actions_js_1.INKD_ACTIONS.PUSH_VERSION,
          description: `Push a new version to an existing inkd project. Costs 0.001 ETH. Content is referenced by Arweave or IPFS hash. Returns txHash and version tag.`,
          schema: actions_js_1.PushVersionSchema,
          invoke: async (params, context) => {
            const fetchFn = await this.buildFetch(context);
            const res = await fetchFn(`${this.apiUrl}/v1/projects/${params.projectId}/versions`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tag: params.tag,
                contentHash: params.contentHash,
                metadataHash: params.metadataHash ?? ""
              })
            });
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
          name: actions_js_1.INKD_ACTIONS.GET_PROJECT,
          description: `Get details about an inkd project by ID. Returns project metadata including owner, version count, license, and description. Free \u2014 no payment needed.`,
          schema: actions_js_1.GetProjectSchema,
          invoke: async (params) => {
            const res = await this.fetch(`${this.apiUrl}/v1/projects/${params.projectId}`);
            if (res.status === 404) {
              return { success: false, message: `Project #${params.projectId} not found.` };
            }
            if (!res.ok)
              throw new Error(`inkd getProject failed: ${res.statusText}`);
            const { data } = await res.json();
            return {
              success: true,
              project: data,
              message: `Project #${data.id}: "${data.name}" by ${data.owner}. ${data.versionCount} versions. License: ${data.license}.`
            };
          }
        };
      }
      // ─── inkd_list_agents ─────────────────────────────────────────────────────
      listAgentsAction() {
        return {
          name: actions_js_1.INKD_ACTIONS.LIST_AGENTS,
          description: `Discover AI agents registered on inkd Protocol. Returns a list of agents with their endpoints, owners, and project IDs. Free \u2014 no payment needed.`,
          schema: actions_js_1.ListAgentsSchema,
          invoke: async (params) => {
            const qs = new URLSearchParams({
              limit: String(params.limit ?? 20),
              offset: String(params.offset ?? 0)
            });
            const res = await this.fetch(`${this.apiUrl}/v1/agents?${qs}`);
            if (!res.ok)
              throw new Error(`inkd listAgents failed: ${res.statusText}`);
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
        if (!context?.walletProvider)
          return this.fetch;
        try {
          const { wrapFetchWithPayment } = await Promise.resolve().then(() => __importStar(require_cjs()));
          const { privateKeyToAccount } = await Promise.resolve().then(() => __importStar(__require("viem/accounts")));
          const { base, baseSepolia } = await Promise.resolve().then(() => __importStar(__require("viem/chains")));
          const privateKey = context.walletProvider?.privateKey;
          if (!privateKey)
            return this.fetch;
          const account = privateKeyToAccount(privateKey);
          const chain = this.apiUrl.includes("sepolia") ? baseSepolia : base;
          return wrapFetchWithPayment(account, chain);
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
    exports.InkdActionProvider = InkdActionProvider2;
  }
});

// src/index.ts
var import_provider = __toESM(require_provider());
var import_actions = __toESM(require_actions());
var export_INKD_ACTIONS = import_actions.INKD_ACTIONS;
var export_InkdActionProvider = import_provider.InkdActionProvider;
export {
  export_INKD_ACTIONS as INKD_ACTIONS,
  export_InkdActionProvider as InkdActionProvider
};
