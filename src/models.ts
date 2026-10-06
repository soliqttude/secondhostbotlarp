export type IPhoneModel={key:string;label:string;megapixels:number;make:"Apple";model:string;software:string;lensMake:"Apple";lensModel:string;focalLength:number;focalLength35mm:number;fNumber:number;targetWidth:number;targetHeight:number;};
const m=(key:string,label:string,megapixels:number,software:string,lensModel:string,focalLength:number,focalLength35mm:number,fNumber:number,targetWidth:number,targetHeight:number):IPhoneModel=>({key,label,megapixels,make:"Apple",model:label,software,lensMake:"Apple",lensModel,focalLength,focalLength35mm,fNumber,targetWidth,targetHeight});
export const IPHONE_MODELS:IPhoneModel[]=[
m("iphone-15-pro-max","iPhone 15 Pro Max",24,"17.0","iPhone 15 Pro Max back triple camera 6.765mm f/1.78",6.765,24,1.78,5712,4284),
m("iphone-15-pro","iPhone 15 Pro",24,"17.0","iPhone 15 Pro back triple camera 6.765mm f/1.78",6.765,24,1.78,5712,4284),
m("iphone-15","iPhone 15",24,"17.0","iPhone 15 back dual wide camera 5.96mm f/1.6",5.96,26,1.6,5712,4284),
m("iphone-14-pro-max","iPhone 14 Pro Max",48,"16.0","iPhone 14 Pro Max back triple camera 6.86mm f/1.78",6.86,24,1.78,8064,6048),
m("iphone-14-pro","iPhone 14 Pro",48,"16.0","iPhone 14 Pro back triple camera 6.86mm f/1.78",6.86,24,1.78,8064,6048),
m("iphone-14","iPhone 14",12,"16.0","iPhone 14 back dual wide camera 5.7mm f/1.5",5.7,26,1.5,4032,3024),
m("iphone-13-pro-max","iPhone 13 Pro Max",12,"15.0","iPhone 13 Pro Max back triple camera 5.7mm f/1.5",5.7,26,1.5,4032,3024),
m("iphone-13-pro","iPhone 13 Pro",12,"15.0","iPhone 13 Pro back triple camera 5.7mm f/1.5",5.7,26,1.5,4032,3024),
m("iphone-13","iPhone 13",12,"15.0","iPhone 13 back dual wide camera 5.1mm f/1.6",5.1,26,1.6,4032,3024),
m("iphone-12-pro-max","iPhone 12 Pro Max",12,"14.0","iPhone 12 Pro Max back triple camera 5.1mm f/1.6",5.1,26,1.6,4032,3024),
m("iphone-12","iPhone 12",12,"14.0","iPhone 12 back dual wide camera 4.2mm f/1.6",4.2,26,1.6,4032,3024)
];
export const getModel=(key:string)=>IPHONE_MODELS.find(x=>x.key===key);