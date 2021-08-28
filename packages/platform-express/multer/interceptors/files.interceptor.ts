import {
  CallHandler,
  ExecutionContext,
  Inject,
  mixin,
  NestInterceptor,
  Optional,
  Type,
  BadRequestException,
} from '@nestjs/common';
import * as multer from 'multer';
import { Observable } from 'rxjs';
import { MULTER_MODULE_OPTIONS } from '../files.constants';
import { MulterModuleOptions } from '../interfaces';
import { MulterOptions } from '../interfaces/multer-options.interface';
import { transformException } from '../multer/multer.utils';

type MulterInstance = any;

export function FilesInterceptor(
  fieldName: string,
  errorOptions: { throwsOnNotFound: boolean } = { throwsOnNotFound: false },
  maxCount?: number,
  localOptions?: MulterOptions,
): Type<NestInterceptor> {
  class MixinInterceptor implements NestInterceptor {
    protected multer: MulterInstance;

    constructor(
      @Optional()
      @Inject(MULTER_MODULE_OPTIONS)
      options: MulterModuleOptions = {},
    ) {
      this.multer = (multer as any)({
        ...options,
        ...localOptions,
      });
    }

    async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<any>> {
      const ctx = context.switchToHttp();

      await new Promise<void>((resolve, reject) =>
        this.multer.array(fieldName, maxCount)(
          ctx.getRequest(),
          ctx.getResponse(),
          (err: any) => {
            if (err) {
              const error = transformException(err);
              return reject(error);
            }
            if (errorOptions.throwsOnNotFound) {
              const req = ctx.getRequest();
              const atLeastOneFilename = req.files
                .map(f => f.fieldname)
                .includes(fieldName);
              if (!atLeastOneFilename) {
                return reject(new BadRequestException(`Unexpected field`));
              }
            }
            resolve();
          },
        ),
      );
      return next.handle();
    }
  }
  const Interceptor = mixin(MixinInterceptor);
  return Interceptor;
}
