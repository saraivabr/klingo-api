@if ($row->is_completed == 0)
{{-- <div class="badge bg-light-warning">
    {{__('messages.appointment.pending')}}
</div> --}}
<select class="form-select" id="addInQueue" data-id="{{ $row->id }}" data-control="select2">
    <option value="0">{{__('messages.appointment.pending')}}</option>
    <option value="4">{{ __('In Queue') }}</option>
</select>
@endif
@if ($row->is_completed == 1 || $row->is_completed == 3)
    <div class="badge bg-light-success {{$row->is_completed == 3 ? "d-none"  : "" }}">
        {{ __('messages.common.confirm') }}
    </div>
@endif
@if($row->is_completed == 3)
<div class="badge bg-light-danger">
    {{__('messages.common.canceled')}}
</div>
@endif
@if($row->is_completed == 4)
<div class="badge bg-light-info">
    {{ __('In Queue') }}
</div>
@endif
