@if ($row->appointment->is_completed == 5)
    <div class="badge bg-light-success">
        {{ __('messages.common.confirm') }}
    </div>
@elseif($row->appointment->is_completed == 4)
    <div class="badge bg-light-primary">
        {{__('In Queue')}}
    </div>
@endif

