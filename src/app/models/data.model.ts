export interface AtomCoords {
  x: number;
  y: number;
  z: number;
}

export interface Atom extends AtomCoords {
  recordName: string,
  serial: number,
  name: string,
  altLoc: string,
  resName: string,
  chainID: string,
  resSeq: number,
  iCode: string,
  occupancy: number,
  tempFactor: number,
  element: string,
  charge: string
}


export interface Residue {
  N: Atom;
  CA: Atom;
  C: Atom;
  phi: number | null;
  psi: number | null;
}

export const extractPhi = (residues: Residue[]): (number | null)[] => residues.map(x => x.phi);
export const extractPsi = (residues: Residue[]): (number | null)[] => residues.map(x => x.psi);

export function extractText(residues: Residue[]): string[] {
  return residues.map(residue => `${residue.CA.resName} ${residue.CA.resSeq} ${residue.CA.chainID}`)
}

export function extractTempFactor(residues: Residue[]): number[] {
  return residues.map(residue => residue.CA.tempFactor);
}

export function extractPosition(residues: Residue[]): number[] {
  return residues.map(residue => residue.CA.resSeq);
}


export function groupResiduesByCAprop(residues: Residue[], key: keyof Atom): [{ key: any, residues: Residue[] }] {
  // @ts-ignore
  let groups: [{ key: any, residues: Residue[] }] = [];
  for (const resi of residues) {
    let groupIdx = groups.findIndex((group) => resi.CA[key] == group.key);
    if (groupIdx == -1)
      groups.push({key: resi.CA[key], residues: [resi]});
    else
      groups[groupIdx].residues.push(resi);
  }
  return groups;
}

export function filterResiduesByName(residues: Residue[], names: string[]): Residue[] {
  return residues.filter(residue => names.includes(residue.CA.resName));
}

export function generateFileFromResidues(residues: Residue[], sep = ','): string {
  let table = ['chain', 'position', 'name', 'phi', 'psi'].join(sep) + '\n';
  residues.forEach(residue => {
    table += [
      residue.CA.chainID,
      residue.CA.resSeq,
      residue.CA.resName,
      residue.phi!.toString(),
      residue.psi!.toString()
    ].join(sep) + '\n'
  })
  return table
}

