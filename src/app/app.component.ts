import {Component, OnInit} from '@angular/core';
import {PdbService} from "./services/pdb.service";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'ramachandran';
  date: Date;

  constructor(private pdb: PdbService) {
    this.date = new Date();
  }

  ngOnInit(): void {
    // this.pdb.fetchData('1my2').subscribe(
    //   x => console.warn(x)
    // )
  }
}
