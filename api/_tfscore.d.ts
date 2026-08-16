export type AssignedItem = {
    id: number;
    title: string;
    iteration: string;
    type: string;
    state: string;
    url: string;
    order: number;
};
export type IterationOption = {
    path: string;
    name: string;
    order: number;
};
export type AssignedResult = {
    items: AssignedItem[];
    iterations: IterationOption[];
};
export declare function fetchAssigned(org: string, pat: string): Promise<AssignedResult>;
