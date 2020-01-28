import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { first, takeUntil, take } from 'rxjs/operators';

import { User, Trip } from '../models';
import debounce from '../utils/debounce';
import { MapBoxService, UserService, AuthenticationService, TripService, AlertService } from '../services';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatSelect } from '@angular/material';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { ReplaySubject, Subject, Subscription } from 'rxjs';
import { MBFeature, MBReply } from '../models/mapbox';


@Component({ templateUrl: 'home.component.html' })
export class HomeComponent implements OnInit {
    currentUser: User;
    trips: Trip[];

    constructor(
        private authenticationService: AuthenticationService,
        private userService: UserService,
        private alertService: AlertService,
        private tripService: TripService,
        public dialog: MatDialog
    ) {
        this.currentUser = this.authenticationService.currentUserValue;
    }

    openDialog(): void {
        const dialogRef = this.dialog.open(TripDialog, {
          width: '250px'
        });
    
        dialogRef.afterClosed().subscribe(result => {
          console.log('The dialog was closed ' + result);
        });
      }

    ngOnInit() {
        this.loadAllTrip();
    }

    public loadAllTrip() {
        console.log(this.currentUser.trip_id)
        if (this.currentUser.trip_id === null)
            return;
        this.userService.getUserTrips(this.currentUser.trip_id)
            .pipe(first())
            .subscribe(trips => {
                console.log(trips)
                this.trips = trips
            });
    }

}

@Component({
    templateUrl: 'trip-dialog.html',
  })
export class TripDialog {
    currentUser: User
    searchText = '';
    places = new MBReply<MBFeature>();
    tmpUsers = new Array();
    tripForm: FormGroup;
    currentPlace: MBFeature;
    public filteredUsersMulti: ReplaySubject<User[]> = new ReplaySubject<User[]>(1);
    protected _onDestroy = new Subject<void>();
    private searchPlaceSub: Subscription;
    private inputWatcher: Subscription;    

    @ViewChild('placeInputSearch', {static: false}) placeInputSearch;
    @ViewChild('singleSelect', { static: true }) singleSelect: MatSelect;
    @ViewChild('multiSelect', { static: true }) multiSelect: MatSelect;
    constructor(
        private authenticationService: AuthenticationService,
        private formBuilder: FormBuilder,
        private userService: UserService,
        private alertService: AlertService,
        public dialogRef: MatDialogRef<TripDialog>,
        private tripService: TripService,
        private mapBoxService: MapBoxService,
        @Inject(MAT_DIALOG_DATA) public data: Trip)
        {
            this.currentUser = this.authenticationService.currentUserValue;
            
            this.tripForm = this.formBuilder.group({
                name: '',
                begin_date: '',
                end_date: '',
                description: '',
                userMultiFilterCtrl: '',
                location: '',
                filterlocation: '',
                users: []
            });
        }
    
    placeClick(feature) {
        this.currentPlace = feature;
    }

    doSearch() {
        if (!!this.searchPlaceSub) {
            this.searchPlaceSub.unsubscribe();
        }
        this.searchPlaceSub = this.mapBoxService.geocoding(this.tripForm.controls.filterlocation.value).subscribe(
            (result) => {
                this.places = result;
            },
            () => {
            }
        );
    }    
    
        
    onNoClick(): void {
      this.dialogRef.close();
    }

    ngOnInit() {
        this.loadAllUsers();
    }

    ngAfterViewInit() {
        console.log(this.tmpUsers);
        this.tripForm.controls.userMultiFilterCtrl.valueChanges
        .pipe(takeUntil(this._onDestroy))
        .subscribe(() => {
            this.filterUsersMulti();
        });
        this.tripForm.controls.filterlocation.valueChanges
        .pipe(takeUntil(this._onDestroy))
        .subscribe(() => {
            this.doSearch();
        });
        this.setInitialValue();
      }

    ngOnDestroy() {
        if (this.searchPlaceSub) {
            this.searchPlaceSub.unsubscribe();
        }
        if (this.inputWatcher) {
            this.inputWatcher.unsubscribe();
        }
        this._onDestroy.next();
        this._onDestroy.complete();
    }

    public onSubmit() {
        if (this.tripForm.invalid) {
            return;
        }
        console.log("LOCATION == " + this.tripForm.controls.filterlocation.value)
        let trip = new Trip()
        trip.name = this.tripForm.controls.name.value;
        trip.begin_date = this.tripForm.controls.begin_date.value;
        trip.end_date = this.tripForm.controls.end_date.value;
        trip.description = this.tripForm.controls.description.value;
        trip.location = this.currentPlace.center[0] + ',' + this.currentPlace.center[1];
        if (!trip) { return; }
        let user_id: string = this.currentUser.id.toString() + ',';
        let users: User[] = this.tripForm.controls.users.value;
        if (users){
        users.forEach(element => {
            user_id += element.id.toString() + ',';
        });
        }
        trip.user_id = user_id;
        console.log(trip.user_id);
        
        this.tripService.addTrip(trip)
        .subscribe(
        data => {
            this.alertService.success('Trip created', true);
            this.dialogRef.close();
        },
        error => {
            this.alertService.error(error);
        });
      }

    private loadAllUsers() {
        this.userService.getUsers()
            .pipe(first())
            .subscribe(users => {
                this.tmpUsers = users
                this.tmpUsers = users.filter(user => user.id != this.currentUser.id)
                console.log(this.tmpUsers);
                this.filteredUsersMulti.next(this.tmpUsers.slice());
            });
        //console.log(this.tmpUsers);
    }

    protected setInitialValue() {
        this.filteredUsersMulti
          .pipe(take(1), takeUntil(this._onDestroy))
          .subscribe(() => {
            this.multiSelect.compareWith = (a: User, b: User) => a && b && a.id === b.id;
          });
      }

    protected filterUsersMulti() {

        // get the search keyword
        let search = this.tripForm.controls.userMultiFilterCtrl.value;
        if (!search) {
          this.filteredUsersMulti.next(this.tmpUsers.slice());
          return;
        } else {
          search = search.toLowerCase();
        }
        // filter the banks
        this.filteredUsersMulti.next(
          this.tmpUsers.filter(user => user.username.toLowerCase().indexOf(search) > -1)
        );
      }
  
  }