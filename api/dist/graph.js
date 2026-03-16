"use strict";
/**
 * @file graph.ts
 * @description The Graph subgraph client for Inkd Protocol.
 *
 * Provides typed GraphQL queries against the deployed subgraph.
 * Falls back to RPC-based queries when subgraph is unavailable.
 *
 * Subgraph: https://thegraph.com/studio/subgraph/inkd
 * Query endpoint: https://api.studio.thegraph.com/query/1743853/inkd/v0.1.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphClient = void 0;
exports.getGraphClient = getGraphClient;
exports.initGraphClient = initGraphClient;
// ─── Client ───────────────────────────────────────────────────────────────────
class GraphClient {
    endpoint;
    constructor(endpoint) {
        this.endpoint = endpoint;
    }
    async query(gql, variables) {
        const res = await fetch(this.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: gql, variables }),
        });
        if (!res.ok) {
            throw new Error(`Graph query failed: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        if (json.errors?.length) {
            throw new Error(`Graph error: ${json.errors.map((e) => e.message).join(', ')}`);
        }
        return json.data;
    }
    /** List projects with optional pagination. */
    async getProjects(options = {}) {
        const { offset = 0, limit = 20, isAgent, owner } = options;
        const conditions = [];
        if (isAgent !== undefined)
            conditions.push(`isAgent: ${isAgent}`);
        if (owner)
            conditions.push(`owner: "${owner.toLowerCase()}"`);
        const filter = conditions.length > 0 ? `where: { ${conditions.join(', ')} }` : '';
        const data = await this.query(`
      query GetProjects($skip: Int!, $first: Int!) {
        projects(skip: $skip, first: $first, orderBy: createdAt, orderDirection: desc, ${filter}) {
          id name description isAgent versionCount createdAt readmeHash metadataUri
          owner { id }
          forkOf { id }
        }
      }
    `, { skip: offset, first: limit });
        return data.projects;
    }
    /** Get a single project by on-chain ID. */
    async getProject(id) {
        const data = await this.query(`
      query GetProject($id: ID!) {
        project(id: $id) {
          id name description isAgent versionCount createdAt readmeHash metadataUri
          owner { id }
          forkOf { id }
        }
      }
    `, { id: id.toString() });
        return data.project;
    }
    /** Find a project by exact name (case-sensitive). */
    async getProjectByName(name) {
        const data = await this.query(`
      query GetProjectByName($name: String!) {
        projects(where: { name: $name }, first: 1) {
          id name description isAgent versionCount createdAt readmeHash metadataUri
          owner { id }
          forkOf { id }
        }
      }
    `, { name });
        return data.projects[0] ?? null;
    }
    /** Search projects by name prefix or description substring. */
    async searchProjects(query, limit = 20) {
        const data = await this.query(`
      query SearchProjects($query: String!, $first: Int!) {
        projects(
          where: { or: [{ name_contains_nocase: $query }, { description_contains_nocase: $query }] }
          first: $first
          orderBy: versionCount
          orderDirection: desc
        ) {
          id name description isAgent versionCount createdAt readmeHash metadataUri
          owner { id }
        }
      }
    `, { query, first: limit });
        return data.projects;
    }
    /** Get all versions for a project. */
    async getProjectVersions(projectId, limit = 50) {
        const data = await this.query(`
      query GetVersions($projectId: String!, $first: Int!) {
        versions(
          where: { project: $projectId }
          first: $first
          orderBy: versionIndex
          orderDirection: asc
        ) {
          id versionIndex readmeHash versionTag createdAt
          pushedBy { id }
          agentAddress { id }
        }
      }
    `, { projectId: projectId.toString(), first: limit });
        return data.versions;
    }
    /** Get projects owned by a wallet address. */
    async getProjectsByOwner(address, limit = 50) {
        const data = await this.query(`
      query GetProjectsByOwner($owner: String!, $first: Int!) {
        projects(where: { owner: $owner }, first: $first, orderBy: createdAt, orderDirection: desc) {
          id name description isAgent versionCount createdAt readmeHash metadataUri
          owner { id }
        }
      }
    `, { owner: address.toLowerCase(), first: limit });
        return data.projects;
    }
    /** Get protocol stats. */
    async getStats() {
        const data = await this.query(`
      query GetStats {
        protocolStats(id: "global") {
          totalProjects totalVersions totalAgents totalSettled
        }
      }
    `);
        return data.protocolStats;
    }
    /** Count total projects (from stats entity). */
    async getProjectCount() {
        const stats = await this.getStats();
        return stats?.totalProjects ?? 0;
    }
}
exports.GraphClient = GraphClient;
// ─── Singleton factory ────────────────────────────────────────────────────────
let _graphClient = null;
function getGraphClient() {
    return _graphClient;
}
function initGraphClient(endpoint) {
    _graphClient = new GraphClient(endpoint);
    return _graphClient;
}
//# sourceMappingURL=graph.js.map