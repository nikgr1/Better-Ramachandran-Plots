import {Component, OnInit} from '@angular/core';
import {AbstractControl, FormControl, ValidationErrors, ValidatorFn, Validators} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";

export function exactLength(len: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const permitted = control.value.length == len;
    return permitted ? null : {exactLength: {value: control.value}};
  };
}

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss']
})
export class StartComponent implements OnInit {
  pdbIdControl: FormControl = new FormControl('', [
    Validators.required,
    exactLength(4),
    Validators.pattern('^[A-Za-z0-9]+$')
  ]);

  constructor(private router: Router) {
  }

  ngOnInit(): void {
  }

  onInput() {
    this.pdbIdControl.setValue(this.pdbIdControl.value.toUpperCase())
  }

  onEnter() {
    if(this.pdbIdControl.valid) {
      this.router.navigate(['pdb', this.pdbIdControl.value])
    }
  }
}
