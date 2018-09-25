(function () {
    angular.module("tawani.utils", []).directive('taDateRangePicker',
        ["$compile", "$timeout", function ($compile, $timeout) {
            const CUSTOM = "CUSTOM";

            let inputFormat = "l";
            let pickerDateFormat = "MM/DD/YYYY";
            let monthFormat = "MMM YYYY";

            return {
                scope: {
                    model: "=ngModel",
                    ranges: "=?",
                    callback: "&"
                },
                template: html`
                <div class="selectbox">
                    <i class="glyphicon glyphicon-calendar"></i>
                    <span ng-show="model">{{model.start.format(inputFormat)}}
                        - {{model.end.format(inputFormat)}}</span>
                    <span ng-hide="model">Select date range</span>
                    <b class="caret"></b>
                </div>`,
                compile(tElement, tAttrs, transclude) {
                    return {
                        pre($scope, element, attrs, controller) {
                            //check for valueless attributes
                            $scope.mustApply = attrs.hasOwnProperty('mustApply')
                            // if mustApply is set, then always show calendars
                            $scope.alwaysShowCalendars = attrs.hasOwnProperty('alwaysShowCalendars') || $scope.mustApply;
                        },
                        post($scope, element, attrs, controller) {
                            $scope.weekDays = moment.weekdaysMin();

                            $scope.inputFormat = inputFormat;

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
                                return $scope.visible = true;
                            };
                            $scope.hide = function ($event) {
                                tryStopProp($event)
                                $scope.visible = false;
                                return $scope.start = null;
                            };
                            $scope.handlePickerClick = function ($event) {
                                return tryStopProp($event);
                            };

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
                                    $scope.inputDates[0] = current.start.format(pickerDateFormat);
                                    $scope.inputDates[1] = '';
                                } else if (current.start && !current.end) {
                                    if (current.start.isAfter(date, 'day')) {
                                        // if end date is before start, make this the new start
                                        // current.start = moment(date);
                                        // $scope.inputDates[0] = current.start.format(pickerDateFormat);

                                        // if end date is before start, swap start and end
                                        current.end = current.start
                                        current.start = moment(date);
                                        $scope.inputDates[0] = current.start.format(pickerDateFormat);
                                        $scope.inputDates[1] = current.end.format(pickerDateFormat);
                                    }
                                    else if (current.start.isBefore(date, 'day')) {
                                        current.end = moment(date);
                                        $scope.inputDates[1] = current.end.format(pickerDateFormat);
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
                                // FIXME: This is a bug, range.clone doesn't work anymore after removing moment-range
                                $scope.currentSelection = range.clone();
                                $scope.updateStartOrEndDate();
                                if($scope.mustApply){
                                    $scope.inputDates[0] = $scope.currentSelection.start.format(pickerDateFormat);
                                    $scope.inputDates[1] = $scope.currentSelection.end.format(pickerDateFormat);
                                }
                                else{
                                    $scope.showCalendars = false;
                                    $scope.selection = $scope.currentSelection.clone();
                                    $scope.commitAndClose($event);
                                }
                            };

                            $scope.commitAndClose = function () {
                                $scope.model = $scope.selection;
                                $timeout(function () {
                                    if ($scope.callback) {
                                        return $scope.callback();
                                    }
                                });
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

                                $scope.months[0] = createMonth(currentStart);
                                $scope.months[1] = createMonth(currentEnd);
                            }

                            $scope.getCurrentSelection = function() {
                                if (!$scope.currentSelection && $scope.selection)
                                    $scope.currentSelection = $scope.selection.clone();
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

                            $scope.updateStartOrEndDate = function (first, last) {
                                var current = $scope.getCurrentSelection();

                                if (first) {
                                    var start = moment($scope.inputDates[0]);
                                    if (!start)
                                        return;

                                    current.start = start;
                                    if (!current.end || current.end.isBefore(start, 'day')) {
                                        current.end = start;
                                        $scope.inputDates[1] = current.end.format(pickerDateFormat);
                                    }
                                } else if (last) {
                                    var end = moment($scope.inputDates[1]);
                                    if (!end)
                                        return;

                                    current.end = end;
                                    if (!current.start || current.start.isAfter(end, 'day')) {
                                        current.start = end;
                                        $scope.inputDates[0] = current.start.format(pickerDateFormat);
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
                                    $scope.months[0] = createMonth(start.clone());
                                    $scope.months[1] = createMonth(start.clone().add(1, 'months'));
                                }
                            }

                            /**************************************************************************************/
                            //load popup template
                            var el = $compile(angular.element(getPickDateTemplate()))($scope);
                            element.append(el);

                            element.bind("click", function (e) {
                                if (e !== null) {
                                    if (typeof e.stopPropagation === "function") {
                                        e.stopPropagation();
                                    }
                                }
                                return $scope.$apply(function () {
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
                            angular.element(document).bind("click", documentClickFn);
                            $scope.$on('$destroy', function () {
                                return angular.element(document).unbind('click', documentClickFn);
                            });
                        },
                    }
                }
            };
            //Unsure why this is built this way, but left in when refactoring anyways, _for now_
            function tryStopProp($event) {
                return $event && typeof $event.stopPropagation === "function" ?
                    $event.stopPropagation() : void 0;
            }

            function prepareRanges($scope) {
                if ($scope.ranges[$scope.ranges.length - 1].range !== CUSTOM)
                    $scope.ranges.push({ label: 'Custom Range', range: CUSTOM });

                $scope.resetRangeClass();

                if ($scope.ranges[$scope.ranges.length - 1].active)
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

                $scope.months.push(createMonth(start.clone().startOf("month")));
                $scope.months.push(createMonth(start.clone().startOf("month").add(1, "month")));

                $scope.inputDates = [];
                $scope.inputDates.push(start.format(pickerDateFormat));
                $scope.inputDates.push(end.format(pickerDateFormat));
            }

            function createMonth(date) {
                var month = { name: date.format(monthFormat), date: date, weeks: getWeeks(date) };
                return month;
            }

            function sameMonth(a, b, other) {
                if (a.month() !== b.month()) {
                    return other;
                }
                return a.date();
            }

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
            //Hack to allow html style rendering in Template Literals VS Code
            function html(h, ...values){ return h.join('');};

                function getPickDateTemplate() {
                    return html`
<div ng-show="visible" ng-click="handlePickerClick($event)" class="ta-daterangepicker">
    <div ng-repeat="month in months" class="calendar" ng-show="showCalendars || alwaysShowCalendars">
        <div class="input">
            <input class="input-mini active" type="text" ng-model="inputDates[$index]" ng-change="updateStartOrEndDate($first,$last)"
                ng-blur="moveToMonth($first,$index)" />
            <i class="glyphicon glyphicon-calendar"></i>
            <a ng-show="$last && currentSelection && currentSelection.start && currentSelection.end" href="" ng-click="clear()"><i
                    class="glyphicon glyphicon-remove"></i></a>
        </div>
        <div class="calendar-table">
            <table>
                <thead>
                    <tr>
                        <th class="available">
                            <a ng-if="$first" ng-click="move(month.date, -1, $event)"><i class="glyphicon glyphicon-chevron-left"></i></a>
                        </th>
                        <th colspan="5">
                            <div class="month-name">{{::month.name}}</div>
                        </th>
                        <th class="available">
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
    <div class="ranges">
        <ul>
            <li ng-repeat="item in ranges" ng-class="{\'active\':item.active}" ng-click="setRange(item.range,$event)">
                {{::item.label}}
            </li>
        </ul>
        <div>
            <button class="btn btn-sm btn-success" ng-click="applySelection()" ng-disabled="!showCalendars || !currentSelection || !currentSelection.start || !currentSelection.end">Apply</button>
            <button class="btn btn-sm btn-default" ng-click="hide()">Cancel</button>
        </div>
    </div>
</div>`;
                }
            }
    ]);
})();
