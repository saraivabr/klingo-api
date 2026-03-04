<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "//www.w3.org/TR/html4/strict.dtd">
<html lang="en">

<head>
    <meta http-equiv="Content-Type" content="text/html;charset=UTF-8">
    <link rel="icon" href="{{ asset('web/img/logo.jpg') }}" type="image/png">
    <title>{{ __('Odontogram Details') }}</title>
    <link href="{{ asset('assets/css/bill-pdf.css') }}" rel="stylesheet" type="text/css" />
    @if (getCurrentCurrency() == 'inr')
        <style>
            body {
                font-family: DejaVu Sans, sans-serif !important;
            }
        </style>
    @endif
    <style>
        body {
            font-family: DejaVu Sans, Arial, "Helvetica", Arial, "Liberation Sans", sans-serif;
        }
        .odontogram-container {
            width: 350px;
            height: 500px;
            position: relative;
            margin: 0 auto;
        }

        .tooth {
            width: 30px;
            height: 30px;
            border: 1px solid #000;
            border-radius: 50%;
            background: white;
            text-align: center;
            line-height: 20px;
            font-size: 12px;
            font-weight: bold;
            position: absolute;
            transform: translate(-50%, -50%);
        }

        .highlight {
            background: #673ab7;
            color: white;
        }
        .items-table thead {
          background:rgb(198, 201, 203);
          color: black;
        }
    </style>
</head>

<body>
    <table width="100%" class="mb-20">
        <table width="100%">
            <tr>
                <td class="header-left">
                    <div class="logo"><img width="100px" src="{{ $setting['app_logo'] }}" alt=""></div>
                    <div class="hospital-name">{{ $setting['app_name'] }}</div>
                    <div class="hospital-name font-color-gray">{{ $setting['hospital_address'] }}</div>
                </td>
                <td class="header-right">
                    <div class="main-heading">{{ __('Odontogram Report') }}</div>
                    <div class="invoice-number font-color-gray">
                        {{ \Carbon\Carbon::parse($odontogram->created_at)->format('jS M, Y g:i A') }}</div>
                </td>
            </tr>
        </table>
        <hr>
        <div class="">
            <table class="table w-100">
                <tr>
                    <td colspan="2">
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>{{ __('messages.investigation_report.patient') }}</th>
                                    <th>{{ __('messages.user.email') }}</th>
                                    <th>{{ __('messages.call_log.phone') }}</th>
                                    <th>{{ __('messages.user.gender') }}</th>
                                    <th>{{ __('messages.user.dob') }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                @if (isset($odontogram) && !empty($odontogram))
                                    <tr>
                                        <td> {{ $odontogram->patient->user->full_name }}</td>
                                        <td>{{ $odontogram->patient->user->email }}</td>
                                        <td> {{ !empty($odontogram->patient->user->phone) ? $odontogram->patient->user->phone : __('messages.common.n/a') }}</td>
                                        <td>{{ $odontogram->patient->user->gender == 0 ? 'Male' : 'Female' }}</td>
                                        <td>{{ !empty($odontogram->patient->user->dob) ? Datetime::createFromFormat('Y-m-d', $odontogram->patient->user->dob)->format('jS M, Y') : 'N/A' }}</td>
                                    </tr>
                                @endif
                            </tbody>
                        </table>
                    </td>
                </tr>
            </table>
            <table class="table w-100">
                <tbody>
                    <tr>
                        @php
                            $colorMap = collect(json_decode($odontogram->odontogram, true))->pluck('color', 'key')->toArray();
                        @endphp

                        <td class="text-end desc ms-auto vertical-align-top">
                            <table class="table w-100">
                                <tr class="lh-2">
                                    <div class="mb-3">
                                        <div class="odontogram-container" style="position: relative; width: 350px; height: 500px;">
                                            @php
                                                $positions = [
                                                    1 => ['top' => '40px', 'left' => '170px'],
                                                    2 => ['top' => '55px', 'left' => '135px'],
                                                    3 => ['top' => '75px', 'left' => '110px'],
                                                    4 => ['top' => '100px', 'left' => '95px'],
                                                    5 => ['top' => '130px', 'left' => '90px'],
                                                    6 => ['top' => '160px', 'left' => '95px'],
                                                    7 => ['top' => '185px', 'left' => '110px'],
                                                    8 => ['top' => '205px', 'left' => '135px'],
                                                    9 => ['top' => '215px', 'left' => '170px'],
                                                    10 => ['top' => '205px', 'left' => '205px'],
                                                    11 => ['top' => '185px', 'left' => '230px'],
                                                    12 => ['top' => '160px', 'left' => '245px'],
                                                    13 => ['top' => '130px', 'left' => '250px'],
                                                    14 => ['top' => '100px', 'left' => '245px'],
                                                    15 => ['top' => '75px', 'left' => '230px'],
                                                    16 => ['top' => '55px', 'left' => '205px'],
                                                    17 => ['top' => '265px', 'left' => '205px'],
                                                    18 => ['top' => '285px', 'left' => '230px'],
                                                    19 => ['top' => '310px', 'left' => '245px'],
                                                    20 => ['top' => '340px', 'left' => '250px'],
                                                    21 => ['top' => '370px', 'left' => '245px'],
                                                    22 => ['top' => '395px', 'left' => '230px'],
                                                    23 => ['top' => '410px', 'left' => '205px'],
                                                    24 => ['top' => '420px', 'left' => '170px'],
                                                    25 => ['top' => '410px', 'left' => '135px'],
                                                    26 => ['top' => '395px', 'left' => '110px'],
                                                    27 => ['top' => '370px', 'left' => '95px'],
                                                    28 => ['top' => '340px', 'left' => '90px'],
                                                    29 => ['top' => '310px', 'left' => '95px'],
                                                    30 => ['top' => '285px', 'left' => '110px'],
                                                    31 => ['top' => '265px', 'left' => '135px'],
                                                    32 => ['top' => '255px', 'left' => '170px'],
                                                ];
                                            @endphp
                                        
                                            @for ($i = 1; $i <= 32; $i++)
                                                <div class="tooth t{{ $i }}" 
                                                    style="
                                                        top: {{ $positions[$i]['top'] }};
                                                        left: {{ $positions[$i]['left'] }};
                                                        {{ isset($colorMap[$i]) ? 'background-color:' . $colorMap[$i] . ';' : 'background-color: #fff;' }}
                                                    ">
                                                    {{ $i }}
                                                </div>
                                            @endfor
                                        </div>
                                    </div>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </tbody>
            </table>
           
        </div>
    </table>
</body>

</html>
