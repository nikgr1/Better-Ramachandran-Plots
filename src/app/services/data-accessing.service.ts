import {Injectable} from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {map, Observable} from "rxjs";
import {residueData} from "../models/data.model";


@Injectable({
  providedIn: 'root'
})
export class DataAccessingService {

  constructor(private http: HttpClient) {
  }

  sumOfTwoMatrices(data1: number[][], data2: number[][]) {
    let sum = data1;
    for(let i=0; i<data2.length; i++) {
      for(let j=0; j<data2[i].length; j++) {
        sum[i][j] += data2[i][j];
      }
    }
    return sum;
  }

  divideMatrix(data: number[][], divideBy: number) {
    let product = data;
    for(let i=0; i<data.length; i++) {
      for(let j=0; j<data[i].length; j++) {
        product[i][j] += data[i][j] / divideBy;
      }
    }
    return product;
  }

  sumOfResidues(data: number[][][]): number[][] {
    let sum = data[0];
    data.slice(1).forEach(
      x => sum = this.sumOfTwoMatrices(sum, x)
    )
    return sum
  }

  meanOfResidues(data: residueData[]): residueData {
    return {
      residue: data.map(x => x.residue).join('@'),
      values: this.divideMatrix(this.sumOfResidues(data.map(x => x.values)), data.length)
    }
  }

  accessResidueDataRaw(residue: string): Observable<string> {
    return this.http.get(`assets/plots/${residue}.csv`, {responseType: 'text'})
  }

  accessResidueData(residue: string): Observable<number[][]> {
    return this.accessResidueDataRaw(residue).pipe(
      map(x => x.split('\n').map(row => row.split(',').map(cell => parseFloat(cell))))
    )
  }

  getPerpendicularGrid(data: residueData['values']) {
    return {
      x: [...Array(data.length).keys()].map(val => val / data.length * 360 - 180),
      y: [...Array(data[0]!.length).keys()].map(val => val / data[0]!.length * 360 - 180),
    }
  }

  //   return resNameOptions.map(x => {
  //     return {
  //       residue: x.value,
  //       value: this.http.get(`assets/${x.value}.csv`, {responseType: 'text'})
  //     }
  //   })
  // }
  createEmpty(xLen: number, yLen: number) {
    let product = [];
    for(let i = 0; i < xLen; i++) {
      product.push(new Array(yLen ).fill(0));
    }
    return product;
  }
}
