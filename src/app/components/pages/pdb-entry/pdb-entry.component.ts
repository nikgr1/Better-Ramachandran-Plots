import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {catchError, map, merge, Observable, of, publishLast, refCount, Subscription, switchMap, tap} from "rxjs";
import {PdbService} from "../../../services/pdb.service";
import {
  collectChains,
  DataProcessing,
  extractPhi,
  extractPosition,
  extractPsi,
  extractTempFactor,
  extractText,
  filterResiduesByChain,
  filterResiduesByName,
  generateFileFromResidues,
  groupResiduesByCAprop,
  Residue
} from "../../../models/data.model";
import {Plotly} from "angular-plotly.js/lib/plotly.interface";
import {FormControl, FormGroup} from "@angular/forms";
import {MatButtonToggleChange} from "@angular/material/button-toggle";
import {DomSanitizer, SafeResourceUrl} from "@angular/platform-browser";
import {PluginContext} from 'molstar/lib/mol-plugin/context';
import {PluginConfig} from 'molstar/lib/mol-plugin/config';
import {colorStyleOptions, imgDownloadOptions, resNameOptions, tableFormatOptions} from "../../../constants/selections";
import {DefaultPluginUISpec, PluginUISpec} from "molstar/lib/mol-plugin-ui/spec";
import {createPluginUI} from "molstar/lib/mol-plugin-ui";
import {StateObjectSelector} from "molstar/lib/mol-state";
import {ElementRef as ElementRefReact} from "react";

// const MySpec: PluginSpec = {
//   ...DefaultPluginSpec(),
//   config: [
//     [PluginConfig.VolumeStreaming.Enabled, false]
//   ],
//   layout: {
//     initial: {
//       isExpanded: false,
//       showControls: false
//     }
//   },
// }
const spec: PluginUISpec = {
  ...DefaultPluginUISpec(),
  layout: {
    initial: {
      isExpanded: false,
      showControls: false
    }
  },
  components: {
    remoteState: 'none'
  },
  config: [
    [PluginConfig.Viewport.ShowExpand, true],
    [PluginConfig.Viewport.ShowControls, true],
    [PluginConfig.Viewport.ShowSelectionMode, true],
    [PluginConfig.Viewport.ShowAnimation, true],
  ]
};

//https://plotly.com/javascript/line-and-scatter/

@Component({
  selector: 'app-pdb-entry',
  templateUrl: './pdb-entry.component.html',
  styleUrls: ['./pdb-entry.component.scss']
})
export class PdbEntryComponent implements OnInit, OnDestroy {
  public molPlugin!: PluginContext;

  @ViewChild('molstarWrapper') set elementToCheck(element: ElementRefReact<any>) {
    // @ts-ignore
    if (element && element.nativeElement)
      this.activatePlugin(element);
  }

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
      scale: 2 // Multiply title/legend/axis/canvas sizes by this factor
    }
  };
  public layoutInit: Partial<Plotly.Layout> = {
    autosize: true,
    width: 700,
    height: 700,
    title: '',
    xaxis: {
      title: 'Phi (φ), °',
      dtick: 30,
      range: [-180, 180],
    },
    yaxis: {
      title: 'Psi (ψ), °',
      dtick: 30,
      range: [-180, 180],
    },
  }
  public colorStyleOptions = colorStyleOptions;
  public chainOptions: string[] = [];
  public resNameOptions = resNameOptions;
  public tableFormatOptions = tableFormatOptions;
  public RPSettings = new FormGroup({
    colorStyle: new FormControl('default'),
    resNameFilter: new FormControl(this.resNameOptions.map(x => x.value)),
    chainFilter: new FormControl(this.chainOptions),
    drawerSize: new FormControl(5),
    tableFormat: new FormControl('csv'),
  })
  public imgDownloadSetting = new FormControl('png');
  public imgDownloadOptions = imgDownloadOptions;
  public layout$: Observable<Partial<Plotly.Layout>> = of(this.layoutInit);
  public config$: Observable<Partial<Plotly.Config>> = of(this.configInit);
  private blob!: Blob;
  public fileUrl!: SafeResourceUrl;
  public errorMsg: string = 'Unknown error';

  public panelStates = {
    settings: false,
    plot: false,
    structure: false
  }
  private model!: StateObjectSelector;

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
    if (this.chainOptions.length != 0) {
      residues = filterResiduesByChain(residues, this.RPSettings.value.chainFilter!);
    }
    let sep = this.tableFormatOptions.find(x => x.value == this.RPSettings.value.tableFormat)!.sep;
    this.blob = new Blob([generateFileFromResidues(residues, sep)], {type: 'application/octet-stream'});
    this.fileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(this.blob));

    switch (this.RPSettings.value.colorStyle) {
      case 'tempFactor':
        return [{
          ...this.getStandardDataElement(residues),
          marker: {size: this.RPSettings.value.drawerSize, color: extractTempFactor(residues)}
        }];
      case 'residue':
        return groupResiduesByCAprop(residues, 'resName').map(
          group => {
            return {
              ...this.getStandardDataElement(group.residues),
              name: group.key,
              marker: {size: this.RPSettings.value.drawerSize}
            }
          }
        );
      case 'position':
        return [{...this.getStandardDataElement(residues),  marker: {size: this.RPSettings.value.drawerSize, color: extractPosition(residues)}}];
      case 'chain':
        return groupResiduesByCAprop(residues, 'chainID').map(
          group => {
            return {
              ...this.getStandardDataElement(group.residues),
              name: "Chain " + group.key,
              marker: {size: this.RPSettings.value.drawerSize}
            };
          }
        );
      default:
        return [{...this.getStandardDataElement(residues), marker: {size: this.RPSettings.value.drawerSize}}];
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

  constructor(
    private host: ElementRef,
    private zone: NgZone,
    private route: ActivatedRoute,
    private pdbS: PdbService,
    private sanitizer: DomSanitizer,
    private ref: ChangeDetectorRef) {
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
        this.chainOptions = collectChains(residues).sort();
        this.selectAllChains();
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

    this.observer = new ResizeObserver(entries => {
      this.zone.run(() => {
        let width = Math.round(entries[0].contentRect.width / 100 - 0.5) * 100;
        width = (width > 700 ? 700 : width)
        this.layoutInit['width'] = width;
        this.layoutInit['height'] = width;
        this.layout$ = of(this.layoutInit);
      });
    });
    this.observer.observe(this.host.nativeElement);

  }
  private observer!: ResizeObserver;

  async activatePlugin(parentElem: ElementRefReact<any>) {
    // @ts-ignore
    const parent = parentElem.nativeElement;

    this.molPlugin = await createPluginUI(parent);
    await this.molPlugin.clear();

    this.subscription.add(this.fetchedData$.subscribe(async pdbRaw => {
      const data = await this.molPlugin.builders.data.rawData({
        data: pdbRaw
      });
      const trajectory = await this.molPlugin.builders.structure.parseTrajectory(data, 'pdb');
      await this.molPlugin.builders.structure.hierarchy.applyPreset(trajectory, 'default');
      this.model = await this.molPlugin.builders.structure.createModel(trajectory);
      this.subscription.add(this.molPlugin.behaviors.interaction.click.subscribe(x => {
          }
      ));
      this.subscription.add(this.molPlugin.managers.structure.selection.events.changed.subscribe(x => {
        }));
      //Script.getStructureSelection()
      // this.subscription.add(this.molPlugin.behaviors.interaction.drag.subscribe(x => console.log(x)));
      // this.subscription.add(this.molPlugin.managers.interactivity.subscribe(x => console.log(x)));
      // this.subscription.add(this.molPlugin.managers.structure.focus.behaviors.current.subscribe(x => console.log(x, this.molPlugin.managers.interactivity.lociHighlights.props)));

      // //@ts-ignore
      // this.molPlugin.managers.camera.focusLoci(ligandLoci);
      // //@ts-ignore
      // this.molPlugin.managers.interactivity.lociSelects.select({loci: ligandLoci});

      // this.subscription.add(this.molPlugin.managers.structure.selection.events.loci.add.subscribe(x => {
      //   //console.warn(x.structure);
      //   let selections = this.molPlugin.managers.structure.hierarchy.selection
      //   for (let i = 0; i < selections.structures.length; i++) {
      //     for (let j = 0; j < selections.structures[i].components.length; j++) {
      //       const ligandData = selections.structures[i].components[j].cell.obj?.data;
      //       const ligandLoci = Structure.toStructureElementLoci(ligandData as any);
      //       //console.log(i, j, ligandLoci);
      //     }
      //   }
      //
      // }))
      // this.subscription.add(this.molPlugin.managers.structure.selection.events.changed.subscribe(x => {
      //   let keys = this.molPlugin.managers.structure.selection.entries.keys();
      //   // @ts-ignore
      //   //console.log('changed', x, this.molPlugin.managers.structure.hierarchy.selection)
      //   const ligandData = this.molPlugin.managers.structure.hierarchy.selection.structures[0]?.components[0]?.cell.obj?.data;
      //   const ligandLoci = Structure.toStructureElementLoci(ligandData as any);
      //   console.warn(this.molPlugin.managers.structure.selection.events.loci);
      // }))
    }))
    //const data = await this.molPlugin.builders.data.download({ url: pdbEntry(this.pdbID) }, { state: { isGhost: true } });
    //console.log(data);

  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.observer.unobserve(this.host.nativeElement);
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
    this.RPSettings.patchValue({resNameFilter: this.resNameOptions.map(x => x.value)});
  }
  clearAllChains() {
    this.RPSettings.patchValue({chainFilter: []});
  }
  selectAllChains() {
    this.RPSettings.patchValue({chainFilter: this.chainOptions});
  }

  isColorCustom() {
    return this.RPSettings.value.colorStyle != 'default';
  }

  isResnFilterCustom() {
    return !this.resNameOptions.map(x => x.value).every(x => this.RPSettings.value.resNameFilter!.includes(x));
  }

  isChainFilterCustom() {
    return !this.chainOptions.every(x => this.RPSettings.value.chainFilter!.includes(x));
  }


}

