export interface InkdConfig {
    /** inkd API base URL. Default: https://api.inkdprotocol.com */
    apiUrl?: string;
    /** Network. Default: mainnet */
    network?: 'mainnet' | 'testnet';
}
export interface InkdProject {
    id: string;
    name: string;
    description: string;
    license: string;
    owner: string;
    isPublic: boolean;
    isAgent: boolean;
    agentEndpoint: string;
    createdAt: string;
    versionCount: string;
}
export interface InkdVersion {
    versionId: string;
    projectId: string;
    tag: string;
    contentHash: string;
    metadataHash: string;
    pushedAt: string;
    pusher: string;
}
