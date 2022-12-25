import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from "@angular/common/http";
import {catchError, delay, map, Observable, publishLast, refCount, tap, throwError, timeout} from "rxjs";
import {pdbEntry} from "../constants/urls";
import {Atom, AtomCoords, Residue} from "../models/data.model";
import {dihedralAngle, rad2deg} from "../helpers/linear-algebra";

@Injectable({
  providedIn: 'root'
})
export class PdbService {
  private headers: HttpHeaders;
  constructor(private http: HttpClient) {
    this.headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');
  }

  getAtomName(atomLine: string): string {
    return atomLine.slice(12, 16).trim()
  }
  getAtomInfoFromLine(atomLine: string): Atom {
    //https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html
    return {
      recordName: atomLine.slice(0, 6).trim(),
      serial: parseInt(atomLine.slice(6, 11).trim()),
      name: this.getAtomName(atomLine),
      altLoc: atomLine[16],
      resName: atomLine.slice(17, 20).trim(),
      chainID: atomLine[21],
      resSeq: parseInt(atomLine.slice(22, 26).trim()),
      iCode: atomLine[26],
      x: parseFloat(atomLine.slice(32, 38).trim()),
      y: parseFloat(atomLine.slice(38, 46).trim()),
      z: parseFloat(atomLine.slice(46, 54).trim()),
      occupancy: parseFloat(atomLine.slice(54, 60).trim()),
      tempFactor: parseFloat(atomLine.slice(60, 66).trim()),
      element: atomLine.slice(76, 78).trim(),
      charge: atomLine.slice(78, 80).trim()
    }
  }

  extractBackboneResidues(pdbEntry: string): Residue[] {
    let backboneRes: Residue[] = [];
    let lastN: Atom = {} as Atom;
    let lastCA: Atom = {} as Atom;
    let splitted = pdbEntry.split('\n');

    for (const line of splitted) {
      if(!line.startsWith('ATOM')) continue;
      let name = this.getAtomName(line);
      if (name == 'N') {
        lastN = this.getAtomInfoFromLine(line);
      }
      else if (name == 'CA') {
        lastCA = this.getAtomInfoFromLine(line);
      }
      else if (name == 'C') {
        backboneRes.push({
          N: lastN,
          CA: lastCA,
          C: this.getAtomInfoFromLine(line),
          phi: null,
          psi: null
        })
      }

    }
    console.log(backboneRes);
    return backboneRes;
  }

  fetchEntryData(pdbId: string): Observable<any> {
    return this.http.get<any>(
      pdbEntry(pdbId),
      // @ts-ignore
      {responseType: 'text' }
    ).pipe(
      timeout(10000),
      publishLast(),
      refCount()
    )
  };

  calculateAngles(pdbEntry: Residue[]): any {
    for (let i = 1; i < pdbEntry.length - 1; i++) {
      pdbEntry[i].phi = rad2deg(dihedralAngle(pdbEntry[i-1].C, pdbEntry[i].N, pdbEntry[i].CA, pdbEntry[i].C));
      pdbEntry[i].psi = rad2deg(dihedralAngle(pdbEntry[i].N, pdbEntry[i].CA, pdbEntry[i].C, pdbEntry[i+1].N));
    }
    return pdbEntry.slice(1, -1);
  }
}
