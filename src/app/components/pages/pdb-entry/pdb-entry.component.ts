import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {catchError, map, merge, Observable, of, publishLast, refCount, Subscription, switchMap, tap} from "rxjs";
import {PdbService} from "../../../services/pdb.service";
import {
  extractPhi,
  extractPosition,
  extractPsi,
  extractTempFactor,
  extractText,
  filterResiduesByName,
  generateFileFromResidues,
  groupResiduesByCAprop,
  Residue
} from "../../../models/data.model";
import {Plotly} from "angular-plotly.js/lib/plotly.interface";
import {FormControl, FormGroup} from "@angular/forms";
import {MatButtonToggleChange} from "@angular/material/button-toggle";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";

//https://plotly.com/javascript/line-and-scatter/
enum DataProcessing {
  Loading = 'loading',
  Calculating = 'calculating',
  Complete = 'complete',
  Error = 'error'
}

@Component({
  selector: 'app-pdb-entry',
  templateUrl: './pdb-entry.component.html',
  styleUrls: ['./pdb-entry.component.scss']
})
export class PdbEntryComponent implements OnInit, OnDestroy {
  public pdbID: string = '';
  public fetchedData$!: Observable<any>;
  public pdbEntry$: Observable<Residue[]> = of();
  public pdbStatus: DataProcessing = DataProcessing.Loading;
  public pdbResidues$: Observable<Residue[]> = of([]);
  private subscription: Subscription = new Subscription();
  public configInit: Partial<Plotly.Config> = {
    toImageButtonOptions: {
      format: 'svg', // one of png, svg, jpeg, webp
      filename: 'custom_image',
      height: 700,
      width: 700,
      scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
    }
  };
  public layoutInit: Partial<Plotly.Layout> = {
    autosize: true,
    width: 700,
    height: 700,
    title: '',
    xaxis: {
      title: 'Phi (φ), °',
      range: [-180, 180]
    },
    yaxis: {
      title: 'Psi (ψ), °',
      range: [-180, 180]
    },
  }
  public colorStyleOptions: { value: string, view: string }[] = [
    {value: 'default', view: 'Default'},
    {value: 'residue', view: 'Residue'},
    {value: 'position', view: 'Position'},
    {value: 'chain', view: 'Chain'},
    {value: 'tempFactor', view: 'Temperature factor (Cα)'},
  ]
  public resNameOptions: { value: string, view: string }[] = [
    {value: 'ALA', view: 'Alanine (ALA, A)'},
    {value: 'ARG', view: 'Arginine (ARG, R)'},
    {value: 'ASN', view: 'Asparagine (ASN, N)'},
    {value: 'ASP', view: 'Aspartic acid (ASP, D)'},
    {value: 'CYS', view: 'Cysteine (CYS, C)'},
    {value: 'GLN', view: 'Glutamine (GLN, Q)'},
    {value: 'GLU', view: 'Glutamic acid (GLU, E)'},
    {value: 'GLY', view: 'Glycine (GLY, G)'},
    {value: 'HIS', view: 'Histidine (HIS, H)'},
    {value: 'ILE', view: 'Isoleucine (ILE, I)'},
    {value: 'LEU', view: 'Leucine (LEU, L)'},
    {value: 'LYS', view: 'Lysine (LYS, K)'},
    {value: 'MET', view: 'Methionine (MET, M)'},
    {value: 'PHE', view: 'Phenylalanine (PHE, F)'},
    {value: 'PRO', view: 'Proline (PRO, P)'},
    {value: 'SER', view: 'Serine (SER, S)'},
    {value: 'THR', view: 'Threonine (THR, T)'},
    {value: 'TRP', view: 'Tryptophan (TRP, W)'},
    {value: 'TYR', view: 'Tyrosine (TYR, Y)'},
    {value: 'VAL', view: 'Valine (VAL, V)'},
    {value: 'PYL', view: 'Pyrrolysine (PYL, O)'},
    {value: 'SEC', view: 'Selenocysteine (SEC, U)'},
  ]

  public tableFormatOptions = [
    {value: 'csv', view: 'CSV', sep: ','},
    {value: 'tsv', view: 'TSV', sep: '\t'}
  ]
  public RPSettings = new FormGroup({
    colorStyle: new FormControl('default'),
    resNameFilter: new FormControl(this.resNameOptions.map(x => x.value)),
    tableFormat: new FormControl('csv'),
  })
  public imgDownloadSetting = new FormControl('png');
  public imgDownloadOptions = [
    {value: 'png', view: 'PNG'},
    {value: 'svg', view: 'SVG'},
    {value: 'jpeg', view: 'JPEG'},
    {value: 'webp', view: 'WEBP'},
  ]
  public layout$: Observable<Partial<Plotly.Layout>> = of(this.layoutInit);
  public config$: Observable<Partial<Plotly.Config>> = of(this.configInit);
  private blob!: Blob;
  public fileUrl!: SafeResourceUrl;
  public errorMsg: string = 'Unknown error';
  public panelOpenState: boolean = false;

  getStandardDataElement(residues: Residue[]) {
    return {
      x: extractPhi(residues),
      y: extractPsi(residues),
      text: extractText(residues),
      mode: 'markers'
    }
  }
  getTableFormatView(): string {
    return this.tableFormatOptions.find(x => x.value == this.RPSettings.value.tableFormat)!.view;
  }


  generateDataFromResidues(residues: Residue[]) {
    residues = filterResiduesByName(residues, this.RPSettings.value.resNameFilter!);
    let sep = this.tableFormatOptions.find(x => x.value == this.RPSettings.value.tableFormat)!.sep;
    this.blob = new Blob([generateFileFromResidues(residues, sep)], {type: 'application/octet-stream'});
    this.fileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(this.blob));
    switch (this.RPSettings.value.colorStyle) {
      case 'tempFactor':
        return [{...this.getStandardDataElement(residues), marker: {color: extractTempFactor(residues)}}];
      case 'residue':
        return groupResiduesByCAprop(residues, 'resName').map(
          group => {
            return {...this.getStandardDataElement(group.residues), name: group.key}
          }
        );
      case 'position':
        return [{...this.getStandardDataElement(residues), marker: {color: extractPosition(residues)}}];
      case 'chain':
        return groupResiduesByCAprop(residues, 'chainID').map(
          group => {
            return {...this.getStandardDataElement(group.residues), name: "Chain " + group.key}
          }
        );
      default:
        return [this.getStandardDataElement(residues)]
    }
  }

  public data$: Observable<Partial<Plotly.Data[]>> = merge(
    of(true).pipe(
      switchMap(
        plotSettings => this.pdbResidues$.pipe(
          map(residues => this.generateDataFromResidues(residues))
        )
      )
    ),
    this.RPSettings.valueChanges.pipe(
      switchMap(
        plotSettings => this.pdbResidues$.pipe(
          map(residues => this.generateDataFromResidues(residues))
        )
      )
    )
  );

  constructor(private route: ActivatedRoute, private pdbS: PdbService, private sanitizer: DomSanitizer,private ref: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    this.pdbID = this.route.snapshot.paramMap.get('id')!;
    this.configInit['toImageButtonOptions'].filename = this.pdbID + '_ramachandran_plot';
    this.layoutInit['title'] = 'Ramachandran plot for ' + this.pdbID;
    this.layout$ = of(this.layoutInit);
    this.config$ = of(this.configInit);
    this.fetchedData$ = this.pdbS.fetchEntryData(this.pdbID);
    this.pdbResidues$ = this.fetchedData$.pipe(
      catchError(err => {
        this.pdbStatus = DataProcessing.Error;
        this.errorMsg = 'Cannot fetch .pdb file for given ID ' + this.pdbID + ' from RCSB PDB';
        return of()
      }),
      //this.pdbEntry$ = of(exampleEntry).pipe(
      tap(entry => {
        this.pdbEntry$ = of(entry);
        this.pdbStatus = DataProcessing.Calculating;
      }),
      map(entry =>
        this.pdbS.extractBackboneResidues(entry)
      ),
      catchError(err => {
        this.pdbStatus = DataProcessing.Error;
        this.errorMsg = 'Cannot read PDB entry ' + this.pdbID;
        return of()
      }),
      map(x =>
        this.pdbS.calculateAngles(x)
      ),
      catchError(err => {
        this.pdbStatus = DataProcessing.Error;
        this.errorMsg = 'Cannot calculate torsion angles of PDB entry ' + this.pdbID;
        return of()
      }),
      tap(residues => {
        this.pdbStatus = DataProcessing.Complete;
      }),
      publishLast(),
      refCount(),
    );
    this.subscription.add(this.pdbResidues$.subscribe());

    this.config$ = merge(
      of(true).pipe(
        switchMap(() => {
          let config = this.configInit;
          config['toImageButtonOptions'].format = this.imgDownloadSetting.value;
          return of(config);
        })
      ),
    this.imgDownloadSetting.valueChanges.pipe(
      switchMap(() => {
        let config = this.configInit;
        config['toImageButtonOptions'].format = this.imgDownloadSetting.value;
        return of(config);
      })
    )
    )

    this.subscription.add(this.config$.subscribe(_ => {
      this.ref.detectChanges();
    }));
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }


  onColorStyleSelected($event: MatButtonToggleChange) {
  }

  getColorView() {
    return this.colorStyleOptions.find(x => x.value == this.RPSettings.value.colorStyle)!.view;
  }

  clearAllResn() {
    this.RPSettings.patchValue({resNameFilter: []})
  }

  selectAllResn() {
    this.RPSettings.patchValue({resNameFilter: this.resNameOptions.map(x => x.value)})
  }

  isColorCustom() {
    return this.RPSettings.value.colorStyle != 'default';
  }

  isFilterCustom() {
    return !this.resNameOptions.map(x => x.value).every(x => this.RPSettings.value.resNameFilter!.includes(x));
  }
}
