@extends('layouts.app')
@section('title')
    Patient Queue
@endsection
@section('content')
    <div class="container-fluid">
        <div class="d-flex flex-column">
            <livewire:patient-queue-table/>
        </div>
    </div>
@endsection

