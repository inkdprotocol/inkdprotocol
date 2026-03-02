/**
 * inkd project <sub-command> — project management
 *
 * Sub-commands:
 *   create   — register a new project (locks 1 $INKD)
 *   get      — fetch project details by ID
 *   list     — list projects owned by an address
 *   transfer — transfer ownership to a new address
 *   collab   — add/remove collaborators
 */
export declare function cmdProjectCreate(args: string[]): Promise<void>;
export declare function cmdProjectGet(args: string[]): Promise<void>;
export declare function cmdProjectList(args: string[]): Promise<void>;
export declare function cmdProjectTransfer(args: string[]): Promise<void>;
export declare function cmdProjectCollab(args: string[]): Promise<void>;
//# sourceMappingURL=project.d.ts.map