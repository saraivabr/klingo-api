@if (Auth::user()->hasRole('Admin|Doctor'))
    <a href="javascript:void(0)" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#add_odontogram_modal">{{ __('Add Odontogram') }}</a>
@endif