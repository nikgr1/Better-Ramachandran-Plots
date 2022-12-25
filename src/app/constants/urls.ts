export const rcsb = 'https://files.rcsb.org/view'
//export const pdbEntry = `${rcsb}/core/entry`

export const pdbEntry = (pdbId: string) => `${rcsb}/${pdbId}.pdb`
