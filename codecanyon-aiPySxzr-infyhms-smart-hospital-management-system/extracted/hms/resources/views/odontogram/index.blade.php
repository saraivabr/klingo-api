@extends('layouts.app')
@section('title')
    {{ __('Odontograms') }}
@endsection
@section('content')
    <div class="container-fluid">
        <div class="d-flex flex-column">
            @include('flash::message')
            {{ Form::hidden('odontogramCreateUrl', route('odontogram.store'), ['id' => 'createOdontogramURL']) }}
            {{ Form::hidden('odontogramUrl', url('odontogram'), ['id' => 'odontogramURL']) }}
            <livewire:odontogram-table/>
            @include('odontogram.modal')
            @include('odontogram.edit_modal')
        </div>
    </div>
@endsection
