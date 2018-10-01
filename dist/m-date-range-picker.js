(function () {
    angular.module("mTools", []).directive('mDateRangePicker',
        ["$compile", "$timeout", function ($compile, $timeout) {
            const CUSTOM = "CUSTOM";

            const defaultInputFormat = "l";
            const defaultPickerDateFormat = "MM/DD/YYYY";
            const defaultMonthFormat = "MMM YYYY";

            console.log("loaded module")

            return {
                scope: {
                    model: "=ngModel",
                    ranges: "=?",
                    callback: "&"
                },
                template: html`
                <div class="selectbox">
                    <i ng-if="!hideCalendarIcons" class="glyphicon glyphicon-calendar"></i>
                    <span ng-show="model">{{model.start.format(inputFormat)}}
                        - {{model.end.format(inputFormat)}}</span>
                    <span ng-hide="model">Select date range</span>
                    <b class="caret"></b>
                </div>`,
                compile(tElement, tAttrs, transclude) {
                    console.log("compiled")
                    return {
                        pre($scope, element, attrs, controller) {
                            //check for valueless attributes
                            $scope.mustApply = attrs.hasOwnProperty('mustApply')
                            // if mustApply is set, then always show calendars
                            $scope.alwaysShowCalendars = attrs.hasOwnProperty('alwaysShowCalendars') || $scope.mustApply;
                            // Don't show the calendar icons
                            $scope.hideCalendarIcons = attrs.hasOwnProperty('hideCalendarIcons') || false;

                            $scope.hideCustomRange = attrs.hasOwnProperty('hideCustomRange') || false;

                            // Define defaults for local variables
                            // Use $scope for instance-specific settings. Using top-level variables creates global setting conflicts.
                            $scope.inputFormat = attrs.inputFormat || defaultInputFormat;
                            $scope.pickerDateFormat = attrs.pickerDateFormat || defaultPickerDateFormat;
                            $scope.monthFormat = attrs.monthFormat || defaultMonthFormat;
                        },
                        post($scope, element, attrs, controller) {
                            $scope.weekDays = moment.weekdaysMin();

                            //set default ranges
                            if (!($scope.ranges && $scope.ranges.length))
                                $scope.ranges = getDefaultRanges();

                            $scope.show = function () {
                                //clear prevs
                                $scope.currentSelection = null;

                                //prepare
                                prepareMonths($scope);
                                $scope.selection = $scope.model;
                                prepareRanges($scope);
                                console.log("show")
                                updatePosition();
                                angular.element(window).bind("resize", onResizeFn);
                                return $scope.visible = true;
                            };

                            $scope.hide = function ($event) {
                                tryStopProp($event)
                                $scope.visible = false;
                                angular.element(window).unbind("resize", onResizeFn);
                                return $scope.start = null;
                            };

                            // No idea why this is setup like this. To prevent click propagation at the root of the directive?!
                            $scope.handlePickerClick = function ($event) {
                                console.log("pickerclick")
                                return tryStopProp($event);
                            };

                            // Handle clicks on a day cell on the visible calendars
                            $scope.select = function (day, $event) {
                                tryStopProp($event);
                                if (day.disabled) {
                                    return;
                                }

                                //both dates are already selected, reset dates
                                var current = $scope.getCurrentSelection();

                                var date = day.date;

                                // TODO: Allow scenario where clicking the same day lets you select 1 day of data, start and end.
                                if ((current.start && current.end) || !current.start) {
                                    current.start = moment(date);
                                    current.end = null;
                                    $scope.inputDates[0] = current.start.format($scope.pickerDateFormat);
                                    $scope.inputDates[1] = '';
                                } else if (current.start && !current.end) {
                                    if (current.start.isAfter(date, 'day')) {
                                        // Kept for clarity, if we want to add this functionality back later
                                        // if end date is before start, make this the new start
                                        // current.start = moment(date);
                                        // $scope.inputDates[0] = current.start.format(pickerDateFormat);

                                        // if end date is before start, swap start and end
                                        current.end = current.start
                                        current.start = moment(date);
                                        $scope.inputDates[0] = current.start.format($scope.pickerDateFormat);
                                        $scope.inputDates[1] = current.end.format($scope.pickerDateFormat);
                                    }
                                    else if (current.start.isBefore(date, 'day')) {
                                        current.end = moment(date);
                                        $scope.inputDates[1] = current.end.format($scope.pickerDateFormat);
                                    }
                                }
                                $scope.resetRangeClass();
                            };

                            $scope.setRange = function (range, $event) {
                                tryStopProp($event);
                                if (!range)
                                    return;
                                if (range === CUSTOM) {
                                    $scope.showCalendars = true;
                                    return;
                                }
                                // unsure why we use clone so much...
                                $scope.currentSelection = {
                                    start: range.start.clone(),
                                    end: range.end.clone()
                                }
                                $scope.updateStartOrEndDate();
                                if($scope.mustApply){
                                    $scope.inputDates[0] = $scope.currentSelection.start.format($scope.pickerDateFormat);
                                    $scope.inputDates[1] = $scope.currentSelection.end.format($scope.pickerDateFormat);
                                }
                                else{
                                    $scope.showCalendars = false;
                                    $scope.selection = {
                                        start: $scope.currentSelection.start.clone(),
                                        end: $scope.currentSelection.end.clone()
                                    };
                                    $scope.commitAndClose($event);
                                }
                            };

                            $scope.commitAndClose = function () {
                                $scope.model = $scope.selection;
                                // if ($scope.callback) {
                                //     $timeout(function () {
                                //         return $scope.callback();
                                //     });
                                // }
                                return $scope.hide();
                            };

                            $scope.clear = function ($event) {
                                tryStopProp($event);
                                $scope.selection = null;
                                $scope.commitAndClose($event);
                            };

                            $scope.applySelection = function ($event) {
                                tryStopProp($event);
                                $scope.showCalendars = true;
                                $scope.selection = {
                                    start: $scope.currentSelection.start.clone(),
                                    end: $scope.currentSelection.end.clone()
                                };
                                $scope.commitAndClose($event);
                            }

                            $scope.move = function (date, n, $event) {
                                tryStopProp($event);

                                var currentStart, currentEnd;

                                if (n < 0) {
                                    currentStart = date.clone().add(n, 'months');
                                    currentEnd = currentStart.clone().add(1, 'months');
                                } else {
                                    currentEnd = date.clone().add(n, 'months');
                                    currentStart = currentEnd.clone().add(-1, 'months');
                                }

                                $scope.months[0] = createMonth(currentStart, $scope.monthFormat);
                                $scope.months[1] = createMonth(currentEnd, $scope.monthFormat);
                            }

                            $scope.getCurrentSelection = function() {
                                if (!$scope.currentSelection && $scope.selection)
                                    $scope.currentSelection = {
                                        start: $scope.selection.start.clone(),
                                        end: $scope.selection.end.clone()
                                    };
                                if (!$scope.currentSelection)
                                    $scope.currentSelection = {};
                                return $scope.currentSelection;
                            }

                            $scope.getClassName = function (day) {

                                var current = $scope.getCurrentSelection();

                                if (!day || day.number === false)
                                    return "off";

                                if (current) {
                                    if (current.start && current.start.isSame(day.date, 'day'))
                                        return "active start-date";
                                    if (current.end && current.end.isSame(day.date, 'day'))
                                        return "active end-date";
                                    if (current.start && current.end && current.start.isBefore(day.date, 'day') && current.end.isAfter(day.date, 'day'))
                                        return "in-range";
                                }
                                return "available";
                            };

                            $scope.resetRangeClass = function () {
                                var found = false;
                                var current = $scope.getCurrentSelection();
                                for (var i = 0; i < $scope.ranges.length; i++) {
                                    var item = $scope.ranges[i];
                                    item.active = false;
                                    if (item.range && item.range !== CUSTOM && current.start && current.end) {
                                        if (current.start.isSame(item.range.start, 'day') && current.end.isSame(item.range.end, 'day')) {
                                            item.active = true;
                                            found = true;
                                        }
                                    }
                                }
                                if (!found)
                                    $scope.ranges[$scope.ranges.length - 1].active = true;
                            };

                            // used by the input handler to update the date range if the left or right calendar input is manually changed via keyboard
                            $scope.updateStartOrEndDate = function (first, last) {
                                var current = $scope.getCurrentSelection();

                                if (first) {
                                    var start = moment($scope.inputDates[0]);
                                    if (!start)
                                        return;

                                    current.start = start;
                                    if (!current.end || current.end.isBefore(start, 'day')) {
                                        current.end = start;
                                        $scope.inputDates[1] = current.end.format($scope.pickerDateFormat);
                                    }
                                } else if (last) {
                                    var end = moment($scope.inputDates[1]);
                                    if (!end)
                                        return;

                                    current.end = end;
                                    if (!current.start || current.start.isAfter(end, 'day')) {
                                        current.start = end;
                                        $scope.inputDates[0] = current.start.format($scope.pickerDateFormat);
                                    }
                                }
                                $scope.resetRangeClass();
                            }

                            $scope.moveToMonth = function (first, index) {
                                if (!first)
                                    return;

                                var start = moment($scope.inputDates[0]);
                                if (!start)
                                    return;

                                if (!start.isSame($scope.months[index].date, 'month')) {
                                    //move to month
                                    $scope.months[0] = createMonth(start.clone(), $scope.monthFormat);
                                    $scope.months[1] = createMonth(start.clone().add(1, 'months'), $scope.monthFormat);
                                }
                            }

                            /**************************************************************************************/
                            // load popup template
                            // IDEA: Global state, if one picker opens, all others close?
                            // IDEA: Backdrop shadow?
                            var el = $compile(angular.element(getPickDateTemplate()))($scope);
                            console.log("appending EL",element,el)
                            element.append(el);

                            element.bind("click", e => {
                                tryStopProp(e)
                                return $scope.$apply(() => {
                                    if ($scope.visible) {
                                        return $scope.hide();
                                    } else {
                                        return $scope.show();
                                    }
                                });
                            });
                            var documentClickFn = function (e) {
                                $scope.$apply(function () {
                                    return $scope.hide();
                                });
                                return true;
                            };
                            var onResizeFn = function (e) {
                                console.log("resized")
                                $scope.$apply(updatePosition)
                            }

                            angular.element(document).bind("click", documentClickFn);
                            $scope.$on('$destroy', function () {
                                angular.element(window).unbind('resize', onResizeFn);
                                return angular.element(document).unbind('click', documentClickFn);
                            });

                            function updatePosition() {
                                console.log('udpating position')
                                var containerTop, containerRight;

                                let dom = element[0],
                                    parentRightEdge = angular.element(window)[0].innerWidth;

                                containerTop = dom.offsetTop + dom.offsetHeight;
                                containerRight = dom.offsetLeft + dom.offsetWidth;
                                let posRight = parentRightEdge - containerRight;
                                let css = {
                                    top: containerTop,
                                    left: 'auto',
                                    right: posRight,
                                }
                                console.log("updating position", css)
                                el.css(css);
                                if (el[0].offsetLeft < 0 ) {
                                    console.log("offset left off of window")
                                    el.css({
                                        left: 10,
                                        right: 'auto'
                                    });
                                }
                            }
                        },
                    }
                }
            };
            ////////////////////////////////////////
            //Non Scope local functions

            //Unsure why this is built this way, but left in when refactoring anyways, _for now_
            function tryStopProp($event) {
                return $event && typeof $event.stopPropagation === "function" ?
                    $event.stopPropagation() : void 0;
            }
            /**
             * Add the Custom range feature, if not disabled via Attr.
             * @param $scope
             */
            function prepareRanges($scope) {
                if (!$scope.hideCustomRange && $scope.ranges[$scope.ranges.length - 1].range !== CUSTOM)
                    $scope.ranges.push({ label: 'Custom Range', range: CUSTOM });

                $scope.resetRangeClass();

                if (!$scope.hideCustomRange && $scope.ranges[$scope.ranges.length - 1].active)
                    $scope.showCalendars = true;
            };

            function prepareMonths($scope) {
                $scope.months = [];
                var start = null;
                var end = null;
                if ($scope.model) {
                    start = $scope.model.start;
                    end = $scope.model.end;
                }

                if (!start) start = moment();
                if (!end) end = moment();

                $scope.months.push(createMonth(start.clone().startOf("month"), $scope.monthFormat));
                $scope.months.push(createMonth(start.clone().startOf("month").add(1, "month"), $scope.monthFormat));

                $scope.inputDates = [];
                $scope.inputDates.push(start.format($scope.pickerDateFormat));
                $scope.inputDates.push(end.format($scope.pickerDateFormat));
            }

            function createMonth(date, monthFormat) {
                return { name: date.format(monthFormat), date: date, weeks: getWeeks(date) };
            }

            function sameMonth(a, b, other) {
                if (a.month() !== b.month()) {
                    return other;
                }
                return a.date();
            }
            // TODO: add start of week as configurable
            function getWeeks(m) {
                var lastOfMonth = m.clone().endOf('month'),
                    lastOfMonthDate = lastOfMonth.date(),
                    firstOfMonth = m.clone().startOf('month'),
                    currentWeek = firstOfMonth.clone().day(0),
                    startOfWeek,
                    endOfWeek;

                var thisMonth = m.month();
                var thisYear = m.year();

                var weeks = [];
                while (currentWeek < lastOfMonth) {
                    startOfWeek = sameMonth(currentWeek.clone().day(0), firstOfMonth, 1);
                    endOfWeek = sameMonth(currentWeek.clone().day(6), firstOfMonth, lastOfMonthDate);

                    var week = [];
                    for (var i = startOfWeek; i <= endOfWeek; i++)
                        // FIXME: uses date and not moment
                        week.push({ number: i, date: new Date(thisYear, thisMonth, i) });

                    var days = week.length;
                    if (days < 7) {
                        if (weeks.length === 0) {
                            while (days < 7) {
                                week.splice(0, 0, { number: false, disabled: true });
                                days += 1;
                            }
                        } else {
                            while (days < 7) {
                                week.push({ number: false, disabled:true });
                                days += 1;
                            }
                        }
                    }
                    weeks.push(week);

                    currentWeek.add(7, 'd');
                }

                return weeks;
            }

            function getDefaultRanges() {
                return [
                    {
                        label: "This week",
                        range: {
                            start: moment().startOf("week").startOf("day"),
                            end: moment().endOf("week").startOf("day")
                        }
                    },
                    {
                        label: "Next Week",
                        range:{
                            start: moment().startOf("week").add(1, "week").startOf("day"),
                            end:  moment().add(1, "week").endOf("week").startOf("day")
                        }
                    },
                    {
                        label: "This month",
                        range: {
                            start: moment().startOf("month").startOf("day"),
                            end: moment().endOf("month").startOf("day")
                        }
                    },
                    {
                        label: "Next Month",
                        range: {
                            start: moment().startOf("month").add(1, "month").startOf("day"),
                            end: moment().add(1, "month").endOf("month").startOf("day")
                        }
                    },
                    {
                        label: "Year to date",
                        range: {
                            start: moment().startOf("year").startOf("day"),
                            end: moment().endOf("day")
                        }
                    }
                ];
            }

            // Hack to allow html style rendering in Template Literals VS Code
            // NOTE: Should probably remove in the future
            function html(h, ...values){ return h.join('');};

                function getPickDateTemplate() {
                    return html`
<div ng-show="visible" ng-click="handlePickerClick($event)" class="m-daterangepicker" ng-class="{'calendar-open':showCalendars || alwaysShowCalendars}">
    <div  ng-show="showCalendars || alwaysShowCalendars" class="calendar-container">
        <div ng-repeat="month in months" class="calendar">
            <div class="input">
                <input class="input-mini active" type="text" ng-model="inputDates[$index]" ng-change="updateStartOrEndDate($first,$last)"
                    ng-blur="moveToMonth($first,$index)" />
                <i ng-if="!hideCalendarIcons" class="glyphicon glyphicon-calendar"></i>
                <a ng-show="$last && currentSelection && currentSelection.start && currentSelection.end" href="" ng-click="clear()">
                    <i class="glyphicon glyphicon-remove"></i>
                </a>
            </div>
            <div class="calendar-table">
                <table>
                    <thead>
                        <tr>
                            <th ng-class="{'available':$first}">
                                <a ng-if="$first" ng-click="move(month.date, -1, $event)"><i class="glyphicon glyphicon-chevron-left"></i></a>
                            </th>
                            <th colspan="5">
                                <div class="month-name">{{::month.name}}</div>
                            </th>
                            <th ng-class="{'available':$last}">
                                <a ng-if="$last" ng-click="move(month.date, +1, $event)"><i class="glyphicon glyphicon-chevron-right"></i>
                                </a>
                            </th>
                        </tr>
                        <tr>
                            <th ng-repeat="day in weekDays" class="weekday">{{::day}}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr ng-repeat="week in month.weeks">
                            <td ng-repeat="day in week" ng-class="getClassName(day)">
                                <div ng-if="day.number" ng-click="select(day, $event)">{{::day.number}}</div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="actions">
            <button class="btn btn-sm btn-default" ng-click="hide()">Cancel</button>
            <button class="btn btn-sm btn-primary pull-right" ng-click="applySelection()" ng-disabled="!showCalendars || !currentSelection || !currentSelection.start || !currentSelection.end">Apply</button>
        </div>
    </div>
    <div class="ranges">
        <ul>
            <li ng-repeat="item in ranges" ng-class="{\'active\':item.active}" ng-click="setRange(item.range,$event)">
                {{::item.label}}
            </li>
        </ul>
    </div>
</div>`;
                }
            }
    ]);
})();
