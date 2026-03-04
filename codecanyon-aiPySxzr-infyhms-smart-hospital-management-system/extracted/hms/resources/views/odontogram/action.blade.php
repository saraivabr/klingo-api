<div class="d-flex justify-content-end w-75 ps-125 text-center">
    @if (Auth::user()->hasRole('Admin|Doctor'))
        <a href="javascript:void(0)" title="{{__('messages.common.edit') }}" data-id="{{ $row->id }}"
            class="edit-odontogram-btn btn px-1 text-primary fs-3 ps-0">
             <i class="fa-solid fa-pen-to-square "></i>
        </a>
        <a href="javascript:void(0)" title="{{__('messages.common.delete')}}" data-id="{{ $row->id }}"
           class="delete-odontogram-btn btn px-1 text-danger fs-3 pe-0 {{getCurrentLoginUserLanguageName() == 'ar' ? 'me-2' : ''}}" wire:key="{{$row->id}}">
            <i class="fa-solid fa-trash"></i>
        </a>
    @endif
    <a href="{{ route('odontogram.pdf', ['odontogram' => $row->id]) }}" title="<?php echo __('Print Odontogram'); ?>"
        class="btn px-1 text-warning fs-3 pe-0 {{getCurrentLoginUserLanguageName() == 'ar' ? 'me-2' : ''}}" target="_blank">
        <i class="fa fa-print" aria-hidden="true"></i>
    </a>
</div>
