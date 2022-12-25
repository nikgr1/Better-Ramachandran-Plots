import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {StartComponent} from "./components/pages/start/start.component";
import {PdbEntryComponent} from "./components/pages/pdb-entry/pdb-entry.component";

const routes: Routes = [
  {
    path: '',
    title: 'RP - Home',
    component: StartComponent
  },
  {
    path: 'pdb/:id',
    title: 'RP - PDB Entry',
    component: PdbEntryComponent
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
